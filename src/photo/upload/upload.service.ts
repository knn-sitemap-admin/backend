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

import { ConfigService } from '@nestjs/config';

import sharp from 'sharp';

export type AllowedDomain = 'map' | 'contracts' | 'board' | 'profile' | 'etc';

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

  private readonly cdnBaseUrl: string;
  private readonly isPublic: boolean;
  private readonly usePathStyle: boolean;

  constructor(private readonly configService: ConfigService) {
    this.region = this.configService.get<string>('AWS_REGION') || 'ap-northeast-2';
    this.bucketName = this.configService.get<string>('AWS_S3_BUCKET_NAME') || '';
    this.cdnBaseUrl = (this.configService.get<string>('CDN_BASE_URL') || '').replace(/\/$/, '');
    this.isPublic = this.configService.get<string>('S3_OBJECT_PUBLIC') === 'true';
    this.usePathStyle = this.configService.get<string>('AWS_S3_FORCE_PATH_STYLE') === 'true';

    if (!this.bucketName) {
      this.logger.error('AWS_S3_BUCKET_NAME 이 설정되지 않았습니다.');
    }

    this.s3 = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID') || '',
        secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY') || '',
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

    // 2. S3 Key 안전화: 영문, 숫자, 하이픈(-), 언더스코어(_), 점(.), 괄호(), 한글 허용
    const base = path.basename(decoded);
    const ext = path.extname(base);
    const nameOnly = path.basename(base, ext);

    // 영문/숫자/하이픈/언더스코어/괄호/점/한글 이외의 모든 문자 제거 및 공백은 언더스코어로 변경
    const safeName = nameOnly
      .replace(/[^a-zA-Z0-9\-_\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F()[\].]/g, '')
      .replace(/\s+/g, '_');

    // 파일명이 완전히 비어버리는 경우 방지
    const finalBase = safeName || 'file';
    return (finalBase.slice(0, 100) + ext.toLowerCase());
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
      let ext = path.extname(safeName).toLowerCase(); // ".jpg"
      const nameOnly = safeName.slice(
        0,
        Math.max(1, safeName.length - ext.length),
      );

      // 1. WebP 변환 시도 (이미지인 경우)
      let buffer = file.buffer;
      let currentMime =
        file.mimetype && file.mimetype !== 'application/octet-stream'
          ? file.mimetype
          : this.resolveMimeType(ext, 'application/octet-stream');

      if (currentMime.startsWith('image/') && currentMime !== 'image/svg+xml') {
        try {
          // Sharp를 사용하여 WebP로 변환 (품질 80, effort 4: 속도/압축비 균형)
          const converted = await sharp(file.buffer)
            .webp({ quality: 80, effort: 4 })
            .toBuffer();

          // 변환 성공 시 정보 업데이트
          buffer = converted;
          currentMime = 'image/webp';
          ext = '.webp';
        } catch (e: any) {
          this.logger.warn(`WebP 변환 실패 (${original}): ${e.message}`);
          // 실패 시 원래 버퍼와 미디어타입 유지
        }
      }

      const key = `${domain}/${userId}/${timestamp}-${this.randomSuffix(6)}-${nameOnly}${ext}`;
      const contentDisposition = this.contentDispositionFor(currentMime);

      try {
        const cmd = new PutObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          Body: buffer,
          ContentType: currentMime,
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
   * 깨진 파일 이름(Latin1 -> UTF-8)을 복구합니다.
   * "ì´ë¯¸ì§€" -> "이미지"
   */
  private repairEncoding(str: string): string {
    if (!str) return '';
    try {
      // 1. 이미 정상적인 한글이 포함되어 있다면 변환하지 않음
      if (/[\uAC00-\uD7AF]/.test(str)) return str;

      // 2. UTF-8 바이트가 Latin1으로 잘못 해석된 전형적인 패턴인지 확인
      // (ì, ë, í 등으로 시작하는 3바이트 한글 패턴)
      if (/[ìëí][\u0080-\u00BF]{2}/.test(str)) {
        const repaired = Buffer.from(str, 'latin1').toString('utf8');
        // 복구 결과에 한글이 포함되면 복구 성공으로 간주
        if (/[\uAC00-\uD7AF]/.test(repaired)) {
          return repaired;
        }
      }
    } catch {
      // 무시하고 원본 반환
    }
    return str;
  }

  /**
   * 저장된 경로(Key) 혹은 기존 URL을 접근 가능한 CDN URL로 변환합니다.
   * DB에서 데이터를 불러와 클라이언트에 전달할 때 사용합니다.
   */
  getFileUrl(pathOrUrl: string | null | undefined): string {
    if (!pathOrUrl) return '';

    const base =
      this.cdnBaseUrl ||
      `https://${this.bucketName}.s3.${this.region}.amazonaws.com`;

    // 1. S3 Key만 추출 (이미 전체 URL인 경우 처리)
    let key = pathOrUrl.startsWith('http')
      ? this.extractKeyFromUrl(pathOrUrl)
      : pathOrUrl;

    if (!key) return pathOrUrl || '';

    // 앞쪽 슬래시 제거 및 공백 정제
    key = key.replace(/^\//, '').trim();

    try {
      // 2. 더블 인코딩 방지: 이미 인코딩된 경우를 위해 반복적으로 decode
      let decodedKey = key;
      let prev;
      do {
        prev = decodedKey;
        // decodeURIComponent는 실패할 수 있으므로 안전하게 처리
        try {
          decodedKey = decodeURIComponent(decodedKey);
        } catch {
          break;
        }
      } while (decodedKey !== prev && decodedKey.includes('%'));

      // 3. 깨진 인코딩 복구 시도 (ì´ë¯¸ì§€ -> 이미지)
      // AWS와 DB 둘 다 깨져있더라도, 실제 브라우저가 요청할 때는 
      // 표준 UTF-8로 인코딩된 경로를 더 잘 처리할 수 있습니다.
      // (단, S3 오브젝트명이 실제 깨진 문자열 그대로라면 복구하지 않는 것이 맞으나,
      // 많은 경우 S3는 UTF-8 바이트를 보관하므로 복구가 효과적일 수 있습니다.)
      const repairedKey = this.repairEncoding(decodedKey);

      // 4. 세그먼트별 안전 인코딩 (슬래시는 유지하고 #, +, ? 등은 인코딩)
      const encodedKey = repairedKey
        .split('/')
        .map((segment) => encodeURIComponent(segment))
        .join('/');

      return `${base}/${encodedKey}`;
    } catch (e) {
      // 실패 시 최소한의 안전 장치로 encodeURI 적용
      return `${base}/${encodeURI(key)}`;
    }
  }

  /** 여러 개의 경로를 URL 배열로 변환 */
  getFileUrls(pathsOrUrls: (string | null | undefined)[] | null | undefined): string[] {
    if (!pathsOrUrls || !Array.isArray(pathsOrUrls) || pathsOrUrls.length === 0) return [];
    return pathsOrUrls.map(p => this.getFileUrl(p)).filter(Boolean);
  }

  /** URL에서 S3 Key 추출 */
  extractKeyFromUrl(url: string): string | null {
    if (!url) return null;

    // 1. s3://bucket/key 형태
    if (url.startsWith('s3://')) {
      const parts = url.split('/');
      if (parts.length < 4) return null;
      return parts.slice(3).join('/');
    }

    // 2. HTTP(S) 형태 처리
    try {
      const parsed = new URL(url);

      // CDN_BASE_URL 도메인인 경우
      if (this.cdnBaseUrl && url.startsWith(this.cdnBaseUrl)) {
        return decodeURIComponent(parsed.pathname.replace(/^\//, ''));
      }

      // S3 도메인인 경우 (bucket.s3.region.amazonaws.com 또는 s3.region.amazonaws.com/bucket)
      if (parsed.hostname.includes('amazonaws.com')) {
        // virtual-hosted style: bucket.s3.ap-northeast-2.amazonaws.com/key
        if (parsed.hostname.includes('.s3.')) {
          return decodeURIComponent(parsed.pathname.replace(/^\//, ''));
        }
        // path-style: s3.ap-northeast-2.amazonaws.com/bucket/key
        const parts = parsed.pathname.replace(/^\//, '').split('/');
        if (parts.length >= 2) {
          // 첫 번째 파트는 버킷명이므로 제외
          return decodeURIComponent(parts.slice(1).join('/'));
        }
      }

      // 기타 커스텀 도메인이나 이미 상대 경로인 경우 pathname만 반환
      if (parsed.pathname && parsed.pathname !== '/') {
        return decodeURIComponent(parsed.pathname.replace(/^\//, ''));
      }
    } catch {
      // URL 객체 생성 실패 시 (이미 상대 경로인 경우 등)
      return decodeURIComponent(url.replace(/^\//, ''));
    }

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
