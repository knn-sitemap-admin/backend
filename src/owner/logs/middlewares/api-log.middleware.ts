import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { requestContext } from '../../../common/request-context/request-context';
import { ApiLogWriterService } from '../services/api-log-writer.service';
import { maskSensitiveJson } from '../../../common/logging/mask.util';

function shouldSkip(path: string): boolean {
  if (path.startsWith('/owner')) return true;
  if (path.startsWith('/static')) return true;
  if (path === '/auth/me') return true;
  return false;
}

function safeStringify(v: unknown): string {
  try {
    if (v === undefined) return '';
    return JSON.stringify(v);
  } catch {
    return '[unserializable]';
  }
}

function limitText(s: string, max: number): string {
  const str = String(s ?? '');
  if (str.length <= max) return str;
  return str.slice(0, max) + '...<truncated>';
}

function maskResponseText(text: string): string {
  const t = String(text ?? '');
  if (!t) return '';
  try {
    const parsed = JSON.parse(t);
    const masked = maskSensitiveJson(parsed);
    return JSON.stringify(masked);
  } catch {
    // JSON 아니면 그대로(HTML 등)
    return t;
  }
}

@Injectable()
export class ApiLogMiddleware implements NestMiddleware {
  constructor(private readonly writer: ApiLogWriterService) {}

  use(req: Request & any, res: Response, next: () => void) {
    const path = String((req as any).originalUrl ?? req.url ?? '');
    if (shouldSkip(path)) return next();

    const start = Date.now();

    // request body (마스킹)
    const maskedBodyObj = maskSensitiveJson((req as any).body);
    const reqBody = safeStringify(maskedBodyObj);

    // response body 캡처
    const chunks: Buffer[] = [];
    const oldWrite = res.write.bind(res);
    const oldEnd = res.end.bind(res);

    (res as any).write = (chunk: any, ...args: any[]) => {
      if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      return oldWrite(chunk, ...args);
    };

    (res as any).end = (chunk: any, ...args: any[]) => {
      if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      return oldEnd(chunk, ...args);
    };

    const requestId = randomUUID();

    requestContext.run({ requestId, queries: [] }, () => {
      res.on('finish', async () => {
        const durationMs = Math.max(0, Date.now() - start);
        const statusCode = res.statusCode ?? 0;

        const ua = String(req.headers['user-agent'] ?? '');
        const ip =
          String(req.headers['x-forwarded-for'] ?? '')
            .split(',')[0]
            .trim() || String((req as any).ip ?? '');

        const sUser = (req as any).session?.user;
        const credentialId = sUser?.credentialId
          ? String(sUser.credentialId)
          : null;
        const deviceType = sUser?.deviceType
          ? (String(sUser.deviceType) as 'pc' | 'mobile')
          : null;

        const bodyBuf = Buffer.concat(chunks);
        const rawResText = bodyBuf.toString('utf8');
        const maskedResText = maskResponseText(rawResText);

        try {
          await this.writer.write({
            credentialId,
            deviceType,
            method: String(req.method ?? ''),
            path,
            statusCode,
            durationMs,
            ip: ip || null,
            userAgent: ua || null,
            requestBody: limitText(reqBody, 20000),
            responseBody: limitText(maskedResText, 20000),

            error: null,
          });
        } catch (e) {
          // 로깅 실패해도 본 요청은 영향 없게
          console.error('[ApiLogMiddleware] write failed', e);
        }
      });

      next();
    });
  }
}
