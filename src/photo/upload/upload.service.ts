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

  private repairEncoding(str: string): string {
    if (!str) return '';
    try {
      // 1. 이미 정상적인 한글이 포함되어 있다면 복구할 필요 없음
      if (/[\uAC00-\uD7AF]/.test(str)) return str;

      // 2. Latin1 바이트를 UTF-8로 해석 시도
      const buf = Buffer.from(str, 'latin1');
      const repaired = buf.toString('utf8');

      // 3. 복구된 결과에 한글이 있고, 유효한 UTF-8이면(대체 문자 없음) 복구 성공
      if (!repaired.includes('\uFFFD') && /[\uAC00-\uD7AF]/.test(repaired)) {
        return repaired;
      }
    } catch {
      // 실패 시 원본 반환
    }
    return str;
  }

  /**
   * S3 키 세그먼트를 안전하게 인코딩합니다.
   * 깨진 라틴 문자열(ì ´ë¯¸ì§€)은 Latin1 바이트 그대로 %XX 인코딩합니다.
   */
  private smartEncode(key: string): string {
    if (!key) return '';
    return key
      .split('/')
      .map((segment) => {
        // 한글이 포함되어 있으면 표준 UTF-8 인코딩 (encodeURIComponent)
        if (/[\uAC00-\uD7AF]/.test(segment)) {
          return encodeURIComponent(segment);
        }

        // 한글은 없지만 0x80 이상의 문자가 있다면 '깨진' 라틴 문자열로 간주
        // 해당 바이트 그대로(Latin1) %XX 인코딩 시도
        if (/[\u0080-\u00FF]/.test(segment)) {
          return Array.from(Buffer.from(segment, 'latin1'))
            .map((b) => '%' + b.toString(16).padStart(2, '0').toUpperCase())
            .join('');
        }

        // 그 외 영문/숫자 및 일반 기호는 표준 인코딩
        return encodeURIComponent(segment);
      })
      .join('/');
  }

  /**
   * 저장된 경로(Key) 혹은 기존 URL을 접근 가능한 CDN URL로 변환합니다.
   * DB에서 데이터를 불러와 클라이언트에 전달할 때 사용합니다.
   */
  getFileUrl(pathOrUrl: string | null | undefined): string {
    if (!pathOrUrl) return '';

    const currentBase =
      this.cdnBaseUrl ||
      `https://${this.bucketName}.s3.${this.region}.amazonaws.com`;

    let targetBase = currentBase;
    let key = pathOrUrl;

    // 1. 절대 URL인 경우 처리
    if (pathOrUrl.startsWith('http')) {
      const isInternalS3 =
        pathOrUrl.includes('.amazonaws.com/') &&
        (pathOrUrl.includes(`/${this.bucketName}/`) ||
          pathOrUrl.includes(`${this.bucketName}.s3`));
      const isInternalCdn =
        this.cdnBaseUrl && pathOrUrl.startsWith(this.cdnBaseUrl);

      if (isInternalS3 || isInternalCdn) {
        // 내부 주소인 경우 현재 설정(CDN 등)에 맞춰 재구성하기 위해 Key 추출
        key = this.extractKeyFromUrl(pathOrUrl) || pathOrUrl;
      } else {
        // 외부 주소인 경우 베이스 주소 보존
        try {
          const parsed = new URL(pathOrUrl);
          targetBase = parsed.origin;
          key = parsed.pathname;
        } catch {
          return pathOrUrl;
        }
      }
    }

    if (!key) return pathOrUrl || '';

    // 앞쪽 슬래시 제거 및 정제
    key = key.replace(/^\//, '').trim();

    try {
      // 2. 더블 인코딩 방지 및 디코딩
      let decodedKey = key;
      let prev;
      do {
        prev = decodedKey;
        try {
          decodedKey = decodeURIComponent(decodedKey);
        } catch {
          break;
        }
      } while (decodedKey !== prev && decodedKey.includes('%'));

      // 3. 깨진 인코딩 복구 시도 및 유니코드 정규화 (NFC)
      const repairedKey = this.repairEncoding(decodedKey).normalize('NFC');

      // 4. 스마트 인코딩 적용 (깨진 문자열은 바이트 그대로 인코딩)
      const encodedPath = this.smartEncode(repairedKey);

      return `${targetBase}/${encodedPath}`;
    } catch (e) {
      return `${targetBase}/${encodeURI(key)}`;
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

    if (url.startsWith('s3://')) {
      const parts = url.split('/');
      if (parts.length < 4) return null;
      return parts.slice(3).join('/');
    }

    try {
      const parsed = new URL(url);
      let pathname = parsed.pathname.replace(/^\//, '');

      // 인코딩된 경로라면 디코딩하여 순수 Key 획득 시도
      try {
        pathname = decodeURIComponent(pathname);
      } catch {
        // 무시
      }

      if (parsed.hostname.includes('amazonaws.com')) {
        // virtual-hosted style
        if (parsed.hostname.includes('.s3.')) {
          return pathname;
        }
        // path-style
        const parts = pathname.split('/');
        if (parts.length >= 2) {
          return parts.slice(1).join('/');
        }
      }

      if (this.cdnBaseUrl && url.startsWith(this.cdnBaseUrl)) {
        return pathname;
      }

      return pathname;
    } catch {
      return url.replace(/^\//, '');
    }
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
    }
  }

  /** 여러 개 삭제 */
  async deleteFiles(urls: string[]): Promise<void> {
    if (!urls?.length) return;
    await Promise.all(urls.map(url => this.deleteFile(url)));
  }
}
