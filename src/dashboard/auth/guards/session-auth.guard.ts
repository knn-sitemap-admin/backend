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

    const res = await this.authService.validateActiveSession({
      sessionId: sid,
      credentialId: String(sUser.credentialId),
      deviceType: sUser.deviceType,
    });

    if (res.ok) {
      // 핵심: DB의 최신 role로 세션 role 동기화
      if (req.session?.user && req.session.user.role !== res.role) {
        req.session.user.role = res.role;
        try {
          await new Promise<void>((resolve, reject) => {
            req.session.save((err: any) => (err ? reject(err) : resolve()));
          });
        } catch {
          // 저장 실패해도 이번 요청은 통과시키고(이미 guard 통과),
          // 다음 요청에서 다시 시도하면 됨
        }
      }
      return true;
    }

    // 실패 시: DB 세션 비활성화(best-effort) + Redis 세션 파괴(best-effort)
    try {
      await this.authService.deactivateSessionBySessionId(sid);
    } catch {}

    try {
      await new Promise<void>((r) => req.session.destroy(() => r()));
    } catch {}

    throw new UnauthorizedException('세션이 만료되었거나 유효하지 않습니다');
  }
}
