import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import type { Express } from 'express';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import * as mime from 'mime-types';
import {
  PutObjectCommand,
  S3Client,
  type ObjectCannedACL,
  type ServerSideEncryption,
  type StorageClass,
} from '@aws-sdk/client-s3';

export type AllowedDomain = 'map' | 'contracts' | 'board' | 'profile' | 'etc';

type UploadResult = {
  urls: string[];
  keys: string[];
  domain: AllowedDomain;
  userId: number;
};

@Injectable()
export class UploadService {
  private readonly s3: S3Client;
  private readonly bucketName: string;
  private readonly region: string;
  private readonly allowedDomains: readonly AllowedDomain[] = [
    'map',
    'contracts',
    'board',
    'profile',
    'etc',
  ] as const;

  private readonly isPublic: boolean =
    (process.env.S3_OBJECT_PUBLIC ?? 'false') === 'true';
  private readonly usePathStyle: boolean =
    (process.env.AWS_S3_FORCE_PATH_STYLE ?? 'false') === 'true';

  constructor() {
    this.region = process.env.AWS_REGION || 'ap-northeast-2';
    this.bucketName = process.env.AWS_S3_BUCKET_NAME || '';

    if (!this.bucketName) {
      throw new Error('AWS_S3_BUCKET_NAME 이 설정되지 않았습니다.');
    }

    this.s3 = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
        // 세션 토큰 사용하는 경우: sessionToken: process.env.AWS_SESSION_TOKEN,
      },
      forcePathStyle: this.usePathStyle,
    });
  }

  private getTimestamp(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    return `${y}${m}${d}-${hh}${mm}${ss}`;
  }

  private sanitizeFilename(original: string): string {
    const base = path.basename(original).replace(/[\u0000-\u001F\u007F]/g, '');
    const replaced = base.replace(/\s+/g, '_');
    return replaced.slice(0, 140);
  }

  private randomSuffix(bytes = 6): string {
    // bytes=6 => 12자리 hex
    return crypto.randomBytes(bytes).toString('hex');
  }

  private contentDispositionFor(mimeType: string): 'inline' | 'attachment' {
    if (
      mimeType.startsWith('image/') ||
      mimeType === 'application/pdf' ||
      mimeType.startsWith('text/')
    ) {
      return 'inline';
    }
    return 'attachment';
  }

  // 환경변수 → SDK 리터럴 유니온으로 안전 변환
  private resolveACL(): ObjectCannedACL | undefined {
    if (!this.isPublic) return undefined;
    return 'public-read';
  }

  private resolveSSE(): ServerSideEncryption | undefined {
    const v = (process.env.S3_SSE || 'AES256').toUpperCase();
    if (v === 'AES256') return 'AES256';
    if (v === 'AWS:KMS' || v === 'AWS_KMS') return 'aws:kms';
    return undefined;
  }

  private resolveStorageClass(): StorageClass | undefined {
    const v = (process.env.S3_STORAGE_CLASS || 'STANDARD').toUpperCase();
    // 필요한 값만 화이트리스트
    switch (v) {
      case 'STANDARD':
      case 'STANDARD_IA':
      case 'ONEZONE_IA':
      case 'INTELLIGENT_TIERING':
      case 'GLACIER_IR':
      case 'GLACIER':
      case 'DEEP_ARCHIVE':
        return v as StorageClass;
      default:
        return 'STANDARD';
    }
  }

  private resolveCacheControl(): string | undefined {
    return process.env.S3_CACHE_CONTROL || 'max-age=31536000, immutable';
  }

  private resolveMimeType(extWithDot: string, fallback: string): string {
    // mime.lookup은 string | false 반환
    const guessed = mime.lookup(extWithDot);
    if (typeof guessed === 'string' && guessed.length > 0) return guessed;
    return fallback;
  }

  async uploadFiles(
    files: ReadonlyArray<Express.Multer.File>,
    domain: AllowedDomain,
    userId: string,
  ): Promise<{
    urls: string[];
    keys: string[];
    domain: 'map' | 'contracts' | 'board' | 'profile' | 'etc';
    userId: string;
  }> {
    if (!this.allowedDomains.includes(domain)) {
      throw new BadRequestException(
        `허용되지 않은 domain 입니다. (${this.allowedDomains.join(', ')})`,
      );
    }
    if (!userId) {
      throw new BadRequestException('로그인된 사용자만 업로드할 수 있습니다.');
    }
    if (!files || files.length === 0) {
      throw new BadRequestException('업로드할 파일이 없습니다.');
    }

    const timestamp = this.getTimestamp();
    const urls: string[] = [];
    const keys: string[] = [];

    const sse = this.resolveSSE();
    const storageClass = this.resolveStorageClass();
    const cacheControl = this.resolveCacheControl();

    for (const file of files) {
      const original = file.originalname || 'file';
      const safeName = this.sanitizeFilename(original);
      const ext = path.extname(safeName).toLowerCase(); // ".jpg"
      const nameOnly = safeName.slice(
        0,
        Math.max(1, safeName.length - ext.length),
      );

      const key = `${domain}/${userId}/${timestamp}-${this.randomSuffix(6)}-${nameOnly}${ext}`;

      // file.mimetype가 제대로 오는 경우 우선, 아니면 확장자로 추론
      const baseMime =
        file.mimetype && file.mimetype !== 'application/octet-stream'
          ? file.mimetype
          : this.resolveMimeType(ext, 'application/octet-stream');

      const contentDisposition = this.contentDispositionFor(baseMime);

      try {
        const cmd = new PutObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          Body: file.buffer,
          ContentType: baseMime,
          ServerSideEncryption: sse,
          StorageClass: storageClass,
          CacheControl: cacheControl,
          ContentDisposition: contentDisposition,
          Metadata: {
            uploaded_by: String(userId),
            app_domain: domain,
          },
        });

        await this.s3.send(cmd);

        const url = this.isPublic
          ? `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${encodeURI(key)}`
          : `s3://${this.bucketName}/${key}`;

        urls.push(url);
        keys.push(key);
      } catch (e: any) {
        console.error('PutObject ERR', {
          key,
          name: e?.name,
          message: e?.message,
          code: e?.$metadata?.httpStatusCode,
          cfId: e?.$metadata?.cfId,
          extendedRequestId: e?.$metadata?.extendedRequestId,
        });

        throw new InternalServerErrorException(
          `S3 업로드 실패: ${safeName} | ${e?.name ?? 'Error'} - ${e?.message ?? ''}`,
        );
      }
    }

    return { urls, keys, domain, userId };
  }
}
