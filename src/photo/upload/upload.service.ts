import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import type { Express } from 'express';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import * as mime from 'mime-types';
import {
  DeleteObjectCommand,
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
  private readonly logger = new Logger(UploadService.name);
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
  private readonly cdnBaseUrl: string =
    process.env.CDN_BASE_URL?.replace(/\/$/, '') || '';

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
    // 1. Multer 인코딩 깨짐 수정 (Latin1 -> UTF-8)
    // 브라우저에서 보낸 UTF-8 이름이 서버에서 Latin1로 읽히는 현상 방지
    let decoded = original;
    try {
      if (typeof original === 'string') {
        decoded = Buffer.from(original, 'latin1').toString('utf8');
      }
    } catch (e) {
      decoded = original;
    }

    // 2. S3 Key 안전화: 영문, 숫자, 하이픈(-), 언더스코어(_), 점(.)만 허용
    const base = path.basename(decoded);
    const ext = path.extname(base);
    const nameOnly = path.basename(base, ext);

    // 영문/숫자/하이픈/언더스코어 이외의 모든 문자(한글 포함) 제거
    const safeName = nameOnly.replace(/[^a-zA-Z0-9\-_]/g, '');

    // 파일명이 완전히 비어버리는 경우 방지
    const finalBase = safeName || 'file';
    return (finalBase.slice(0, 100) + ext.toLowerCase()).replace(/\s+/g, '_');
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
            original_name: encodeURIComponent(original),
          },
        });

        await this.s3.send(cmd);

        let url: string;
        if (this.cdnBaseUrl) {
          url = `${this.cdnBaseUrl}/${encodeURI(key)}`;
        } else if (this.isPublic) {
          url = `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${encodeURI(key)}`;
        } else {
          url = `s3://${this.bucketName}/${key}`;
        }

        urls.push(url);
        keys.push(key);
      } catch (e: any) {
        this.logger.error('PutObject ERR', {
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

  /**
   * 저장된 경로(Key) 혹은 기존 URL을 접근 가능한 CDN URL로 변환합니다.
   * DB에서 데이터를 불러와 클라이언트에 전달할 때 사용합니다.
   */
  getFileUrl(pathOrUrl: string | null | undefined): string {
    if (!pathOrUrl) return '';

    // 1. 이미 전체 HTTP 주소인 경우 (S3 혹은 기존 CDN 주소)
    if (pathOrUrl.startsWith('http')) {
      // 혹시 S3 직접 주소라면 CDN 주소로 치환 시도 (선택 사항)
      if (this.cdnBaseUrl && pathOrUrl.includes('.s3.') && pathOrUrl.includes('.amazonaws.com/')) {
        const key = this.extractKeyFromUrl(pathOrUrl);
        if (key) return `${this.cdnBaseUrl}/${encodeURI(key)}`;
      }
      return pathOrUrl;
    }

    // 2. 상대 경로(Key)인 경우 CDN 베이스 주소를 붙임
    const base = this.cdnBaseUrl || `https://${this.bucketName}.s3.${this.region}.amazonaws.com`;
    const cleanPath = pathOrUrl.replace(/^\//, '');
    return `${base}/${encodeURI(cleanPath)}`;
  }

  /** 여러 개의 경로를 URL 배열로 변환 */
  getFileUrls(pathsOrUrls: (string | null | undefined)[] | null | undefined): string[] {
    if (!pathsOrUrls || !Array.isArray(pathsOrUrls) || pathsOrUrls.length === 0) return [];
    return pathsOrUrls.map(p => this.getFileUrl(p)).filter(Boolean);
  }

  /** URL에서 S3 Key 추출 */
  extractKeyFromUrl(url: string): string | null {
    if (!url) return null;

    // s3://bucket/key 형태
    if (url.startsWith('s3://')) {
      const parts = url.split('/');
      if (parts.length < 4) return null;
      return parts.slice(3).join('/');
    }

    // https://bucket.s3.region.amazonaws.com/key 형태
    if (url.includes('.s3.') && url.includes('.amazonaws.com/')) {
      const parts = url.split('.amazonaws.com/');
      if (parts.length < 2) return null;
      return decodeURI(parts[1]);
    }

    // CDN_BASE_URL 형태 처리
    if (this.cdnBaseUrl && url.startsWith(this.cdnBaseUrl)) {
      const relativePath = url.substring(this.cdnBaseUrl.length).replace(/^\//, '');
      return decodeURI(relativePath);
    }

    // 기타: 도메인이 포함된 경우 (CloudFront 등 커스텀 도메인 대응이 필요할 수 있음)
    // 여기서는 기본 S3 URL만 처리
    return null;
  }

  /** S3 오브젝트 삭제 */
  async deleteFile(url: string): Promise<void> {
    const key = this.extractKeyFromUrl(url);
    if (!key) return;

    try {
      const cmd = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });
      await this.s3.send(cmd);
    } catch (e: any) {
      this.logger.error(`[S3 Delete Error] key: ${key}, error: ${e.message}`);
      // 굳이 예외를 던지지 않고 로그만 남김 (삭제 실패가 비즈니스 로직을 중단시키면 안 됨)
    }
  }

  /** 여러 개 삭제 */
  async deleteFiles(urls: string[]): Promise<void> {
    if (!urls?.length) return;
    await Promise.all(urls.map(url => this.deleteFile(url)));
  }
}
