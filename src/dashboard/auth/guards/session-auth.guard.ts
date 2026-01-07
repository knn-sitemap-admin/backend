import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from '../auth.service';

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();

    const sUser = req.session?.user;
    const sid = String(req.sessionID ?? '');

    if (!sUser || !sid) {
      throw new UnauthorizedException('로그인이 필요합니다');
    }

    // 기존 로직 유지 + 예외 로그만 추가(원인 파악용)
    let res: any;
    try {
      res = await this.authService.validateActiveSession({
        sessionId: sid,
        credentialId: String(sUser.credentialId),
        deviceType: sUser.deviceType,
      });
    } catch (e: any) {
      console.error('[SessionAuthGuard] validateActiveSession threw', {
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
