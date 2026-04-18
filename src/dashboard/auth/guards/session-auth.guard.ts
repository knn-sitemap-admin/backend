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
    const path = req.originalUrl;

    let sUser = req.session?.user;
    let sid = String(req.sessionID ?? '');

    // [JWT 대응 추가] 세션이 없으면 Authorization 헤더 확인
    if (!sUser || !sid) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const decoded = await this.authService.verifyToken(token);
        if (decoded) {
          // 세션 구조와 동일하게 req.user 및 가짜 세션 데이터 구성
          sUser = {
            credentialId: decoded.sub,
            role: decoded.role,
            deviceType: 'mobile', // 토큰 사용은 모바일 앱으로 간주
          };
          req.session.user = sUser; // 하위 호환성을 위해 세션 객체에도 주입
          sid = 'JWT_SESSION'; // validateActiveSession 통과를 위한 더미 ID
          this.logger.log(`[JWT Auth] Success: ${decoded.sub} for path ${path}`);
        } else {
          this.logger.warn(`[JWT Auth] Fail: Invalid Token for path ${path}`);
        }
      } else {
        this.logger.debug(`[Auth Check] No Session and No Auth Header for path ${path}`);
      }
    }

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
