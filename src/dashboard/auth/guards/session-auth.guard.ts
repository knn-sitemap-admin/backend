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

    // 1. [JWT 인증 우선순위] Authorization 헤더 확인
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const decoded = await this.authService.verifyToken(token);
        if (decoded) {
          // 토큰이 유효하면 세션 상태와 무관하게 즉시 통과
          req.user = {
            credentialId: decoded.sub,
            role: decoded.role,
            deviceType: 'mobile',
          };
          // 기존 세션 코드 호환성을 위해 주입
          if (req.session) {
            req.session.user = req.user;
          }
          return true;
        }
      } catch (e) {
        // 토큰이 유효하지 않은 경우 명시적 예외 처리
        throw new UnauthorizedException('유효하지 않은 토큰입니다');
      }
    }

    // 2. [세션 인증] 쿠키 기반 인증 시도
    let sUser = req.session?.user;
    let sid = String(req.sessionID ?? '');

    if (!sUser) {
      throw new UnauthorizedException('로그인이 필요합니다');
    }

    // JWT로 복구된 경우 DB 세션 검증 생략 혹은 별도 처리
    if (sid === 'JWT_SESSION') {
      return true;
    }

    // 기존 세션 로직 유지
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
        method: req.method,
        sid: sid ? `${sid.slice(0, 6)}…` : '',
        credentialId: String(sUser?.credentialId ?? ''),
        deviceType: sUser?.deviceType ?? '',
        errName: String(e?.name ?? ''),
        errMessage: String(e?.message ?? e),
        errCode: e && (e.code ?? e.errno) ? String(e.code ?? e.errno) : '',
        stack: e?.stack ? String(e.stack) : '',
      });
      throw e; // 기존 동작 유지(원래 500이던 건 그대로 500)
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

    // 기존 세션은 그대로 유지
    throw new UnauthorizedException('세션이 만료되었거나 유효하지 않습니다');
  }
}
