import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from '../auth.service';

@Injectable()
export class SessionAuthGuard implements CanActivate {
  private readonly logger = new Logger(SessionAuthGuard.name);

  constructor(private readonly authService: AuthService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const url = req.originalUrl;

    // 1. JWT 기반 인증 시도 (쿠키 차단 환경 대응)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = await this.authService.verifyToken(token);
      if (decoded) {
        const user = {
          credentialId: decoded.sub,
          role: decoded.role,
          deviceType: 'mobile',
        };
        req.user = user;

        // 세션이 있으면 넣어주고, 세션 쿠키 복구를 위해 저장 시도
        if (req.session) {
          const isNewSession = !req.session.user;
          req.session.user = user;
          
          if (isNewSession) {
            this.logger.debug(`[JWT Auth] New session initialized for ${user.credentialId} (${url})`);
            // 세션 저장 강제 (Set-Cookie 유도)
            try {
              await new Promise<void>((resolve, reject) => {
                req.session.save((err: any) => (err ? reject(err) : resolve()));
              });
            } catch (e) {
              this.logger.warn(`[JWT Auth] Failed to save session: ${e.message}`);
            }
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
      // 핵심: DB의 최신 role로 세션 role 동기화
      if (req.session?.user && req.session.user.role !== res.role) {
        req.session.user.role = res.role;
        try {
          await new Promise<void>((resolve, reject) => {
            req.session.save((err: any) => (err ? reject(err) : resolve()));
          });
        } catch {
          // 저장 실패해도 이번 요청은 통과
        }
      }
      return true;
    }

    this.logger.warn(`[Session Auth] Session validation failed for ${sid.slice(0, 6)}… (${url})`);
    throw new UnauthorizedException('세션이 만료되었거나 유효하지 않습니다');
  }
}
