import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from '../auth.service';
import { detectDeviceType } from '../../../common/utils/device-type.util';

@Injectable()
export class SessionAuthGuard implements CanActivate {
  private readonly logger = new Logger(SessionAuthGuard.name);

  constructor(private readonly authService: AuthService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const url = req.originalUrl;
    const method = req.method;

    // 0. CORS Preflight 요청은 가드 통과
    if (method === 'OPTIONS') {
      return true;
    }

    // 1. JWT 기반 인증 시도 (쿠키 차단 환경 대응)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = await this.authService.verifyToken(token);
      if (decoded) {
        const ua = String(req.headers['user-agent'] ?? '');
        const deviceType = detectDeviceType(ua);
        
        // JWT 인증 시에도 DB의 최신 정보를 가져와서 세션에 동기화
        const sid = String(req.sessionID ?? 'jwt-session');
        const res = await this.authService.validateActiveSession({
          sessionId: sid,
          credentialId: String(decoded.sub),
          deviceType,
        });

        const user = {
          credentialId: String(decoded.sub),
          role: res.ok ? res.role : decoded.role,
          canDownloadImage: res.ok ? (res as any).canDownloadImage : false,
          deviceType,
        };
        req.user = user;

        if (req.session) {
          req.session.user = user;
          try {
            await new Promise<void>((resolve, reject) => {
              req.session.save((err: any) => (err ? reject(err) : resolve()));
            });
          } catch (e) {
            this.logger.warn(`[JWT Auth] Failed to save session: ${e.message}`);
          }
        }
        return true;
      } else {
        this.logger.warn(`[JWT Auth] Token verification failed for ${url}`);
      }
    }

    // 2. 세션 기반 인증 시도
    const sUser = req.session?.user;
    const sid = String(req.sessionID ?? '');

    if (!sUser || !sid) {
      this.logger.debug(`[Session Auth] No user/sid found for ${url} (Headers: ${!!authHeader})`);
      throw new UnauthorizedException('로그인이 필요합니다');
    }

    // 기존 세션 로직: DB 세션 검증
    let res: any;
    try {
      res = await this.authService.validateActiveSession({
        sessionId: sid,
        credentialId: String(sUser.credentialId),
        deviceType: sUser.deviceType,
      });
    } catch (e: any) {
      this.logger.error('[SessionAuthGuard] validateActiveSession threw', {
        path: url,
        sid: sid ? `${sid.slice(0, 6)}…` : '',
        credentialId: String(sUser?.credentialId ?? ''),
        errMessage: String(e?.message ?? e),
      });
      throw e;
    }

    if (res.ok) {
      // 핵심: DB의 최신 role 및 권한으로 세션 동기화
      const sessionUser = req.session?.user;
      if (
        sessionUser &&
        (sessionUser.role !== res.role ||
          sessionUser.canDownloadImage !== res.canDownloadImage)
      ) {
        sessionUser.role = res.role;
        sessionUser.canDownloadImage = res.canDownloadImage;
        try {
          await new Promise<void>((resolve, reject) => {
            req.session.save((err: any) => (err ? reject(err) : resolve()));
          });
        } catch (e) {
          this.logger.warn(`[SessionAuthGuard] Sync Save Failed: ${e.message}`);
        }
      }
      return true;
    }

    this.logger.warn(`[Session Auth] Session validation failed for ${sid.slice(0, 6)}… (${url})`);
    throw new UnauthorizedException('세션이 만료되었거나 유효하지 않습니다');
  }
}
