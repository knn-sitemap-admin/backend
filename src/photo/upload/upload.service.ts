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
  CopyObjectCommand,
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

      // 1. 이미지 처리 (필요한 경우 Sharp로 리사이징 등은 가능하나 일단 원본 유지)
      let buffer = file.buffer;
      let currentMime =
        file.mimetype && file.mimetype !== 'application/octet-stream'
          ? file.mimetype
          : this.resolveMimeType(ext, 'application/octet-stream');

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
   * S3 상의 파일명을 무조건 깨끗한 이름으로 수정합니다. (인코딩 복구 포기, 강제 수정)
   */
  async repairS3Filename(url: string): Promise<string | null> {
    if (!url) return null;

    const oldKey = this.extractKeyFromUrl(url);
    if (!oldKey) return null;

    try {
      const segments = oldKey.split('/');
      const lastIdx = segments.length - 1;
      const oldFileNameEncoded = segments[lastIdx];

      // 1. 조건 없이 강제 수정 진행 (사용자 요청에 따라 모든 파일을 새 이름으로 변경)

      // 2. 새 이름 생성 (원본 이름 무시하고 안전한 이름으로 생성)
      const ext = oldFileNameEncoded.includes('.') 
        ? '.' + oldFileNameEncoded.split('.').pop()?.split(/[?#]/)[0]
        : '.jpg';
      const newFileName = `fixed-${Date.now()}-${Math.floor(Math.random() * 1000)}${ext}`;
      const newKey = [...segments.slice(0, lastIdx), newFileName].join('/');

      // 3. S3 소스 경로용 인코딩 (커스텀 바이트 디코더)
      // %XX 형태를 무조건 바이트로 해석하여 S3가 인식하게 함
      const rawEncodedOldKey = oldKey.split('/').map(seg => {
        return seg.replace(/%([0-9A-F]{2})/gi, (match, p1) => {
          return String.fromCharCode(parseInt(p1, 16));
        }).split('').map(c => {
          const b = c.charCodeAt(0);
          return '%' + b.toString(16).padStart(2, '0').toUpperCase();
        }).join('');
      }).join('/');

      const copyCmd = new CopyObjectCommand({
        Bucket: this.bucketName,
        CopySource: `${this.bucketName}/${rawEncodedOldKey}`,
        Key: newKey,
        ACL: this.resolveACL(),
        MetadataDirective: 'COPY',
      });

      await this.s3.send(copyCmd);
      
      // 4. 기존 파일 삭제
      await this.s3.send(new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: oldKey
      }));

      this.logger.log(`[Force Repair Success] ${oldKey} -> ${newKey}`);
      return this.getFileUrl(newKey);
    } catch (e: any) {
      this.logger.error(`[Force Repair Failed] ${url}: ${e.message}`);
      return null;
    }
  }

  private repairEncoding(str: string): string {
    if (!str) return '';
    try {
      // 이미 정상 한글이면 통과 (단, 혼합된 경우를 위해 regex 강화 가능)
      if (/[\uAC00-\uD7AF]/.test(str)) return str;

      // 1. Latin1 바이트 추출
      const buf = Buffer.from(str, 'latin1');
      
      // 2. UTF-8로 변환
      const repaired = buf.toString('utf8');

      // 3. 변환된 결과에 한글이 한 글자라도 포함되어 있다면 성공으로 간주
      if (/[\uAC00-\uD7AF]/.test(repaired)) {
        return repaired;
      }
    } catch { }
    return str;
  }

  /**
   * S3 키 세그먼트를 안전하게 인코딩합니다.
   * 한글, 깨진 라틴 문자, ASCII가 섞여 있어도 각각 최적의 바이트로 변환합니다.
   */
  private smartEncode(segment: string): string {
    if (!segment) return '';

    let result = '';
    for (let i = 0; i < segment.length; i++) {
      const char = segment[i];
      const code = char.charCodeAt(0);

      if (code >= 0xac00 && code <= 0xd7af) {
        // 1. 한글: 표준 UTF-8 인코딩
        result += encodeURIComponent(char);
      } else if (code >= 0x80 && code <= 0xff) {
        // 2. 깨진 라틴 문자: 해당 코드값 그대로 바이트(%XX)로 변환
        result += '%' + code.toString(16).padStart(2, '0').toUpperCase();
      } else {
        // 3. ASCII 및 기타: encodeURIComponent (단, S3에서 안전한 일부 특수문자 보존 여부는 표준 따름)
        // encodeURIComponent는 ' ( ) * ! 등을 인코딩하므로 S3와 호환성이 좋습니다.
        result += encodeURIComponent(char);
      }
    }

    // encodeURIComponent가 중복 인코딩한 '/' 등을 복구할 필요는 없음 (세그먼트 단위이므로)
    return result;
  }

  /**
   * 저장된 경로(Key) 혹은 기존 URL을 접근 가능한 CDN URL로 변환합니다.
   * DB에서 데이터를 불러와 클라이언트에 전달할 때 사용합니다.
   */
  getFileUrl(pathOrUrl: string | null | undefined): string {
    if (!pathOrUrl) return '';

    // 1. 이미 절대 URL인 경우 가공하지 않고 그대로 반환
    if (pathOrUrl.startsWith('http')) {
      return pathOrUrl;
    }

    const currentBase =
      this.cdnBaseUrl ||
      `https://${this.bucketName}.s3.${this.region}.amazonaws.com`;

    // 2. 경로 정리
    const key = pathOrUrl.replace(/^\//, '').trim();

    try {
      // 3. 중복 인코딩 방지를 위해 먼저 디코딩 후 다시 인코딩
      const decodedKey = decodeURIComponent(key);
      const finalPath = decodedKey
        .split('/')
        .map((seg) => encodeURIComponent(seg))
        .join('/');

      return `${currentBase}/${finalPath}`;
    } catch (e) {
      // 디코딩 실패 시 (이미 생자인 경우 등) 그냥 인코딩 진행
      const finalPath = key
        .split('/')
        .map((seg) => encodeURIComponent(seg))
        .join('/');
      return `${currentBase}/${finalPath}`;
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
