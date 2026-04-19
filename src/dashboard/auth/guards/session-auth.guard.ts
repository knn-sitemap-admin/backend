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
        // 세션이 있으면 넣어주고, 없어도(Stateless) JWT가 유효하면 통과시킵니다.
        if (req.session) {
          req.session.user = user;
        }
        return true;
      }
    }

    // 2. 세션 기반 인증 시도
    const sUser = req.session?.user;
    const sid = String(req.sessionID ?? '');

    if (!sUser || !sid) {
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
        path: req.originalUrl,
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

    throw new UnauthorizedException('세션이 만료되었거나 유효하지 않습니다');
  }
}
