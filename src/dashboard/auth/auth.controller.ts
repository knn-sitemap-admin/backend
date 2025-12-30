import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { SigninDto } from './dto/signin.dto';
import { BootstrapAdminDto } from './dto/bootstrap-admin.dto';
import { AdminResetDto } from './dto/admin-reset.dto';
import { detectDeviceType } from '../../common/utils/device-type.util';
import { SessionAuthGuard } from './guards/session-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { SystemRole } from '../accounts/types/roles';
import { Roles } from './decorators/roles.decorator';

function destroySessionById(store: any, sid: string): Promise<void> {
  return new Promise((resolve) => {
    if (!store || !sid) return resolve();
    store.destroy(sid, () => resolve()); // 실패해도 resolve (best-effort)
  });
}

@Controller('auth')
export class AuthController {
  constructor(private readonly service: AuthService) {}

  /**
   * @remarks
   * https://www.notion.so/2858186df78b8043a4e0e1e69c41272c?source=copy_link
   * 관리자용(최대권한 계정) 1회 실행 api
   */
  @Post('bootstrap-admin')
  async bootstrapAdmin(@Body() dto: BootstrapAdminDto, @Req() req: Request) {
    const token = req.headers['x-bootstrap-token'] as string | undefined;

    const data = await this.service.bootstrapAdmin(
      dto.email,
      dto.password,
      token,
    );

    return { message: '관리자 부트스트랩 완료', data };
  }

  /**
   * @remarks
   * https://www.notion.so/2858186df78b807e9cedeedd572063c2?source=copy_link
   * 로그인
   */
  @Post('signin')
  async signin(@Body() dto: SigninDto, @Req() req: any) {
    // 1 디바이스 타입 결정
    const ua = String(req.headers['user-agent'] ?? '');
    const deviceType = detectDeviceType(ua);

    // 2 자격 검증
    const base = await this.service.signin(dto.email, dto.password);

    // 3 세션 regenerate
    await new Promise<void>((resolve, reject) => {
      req.session.regenerate((err: any) => (err ? reject(err) : resolve()));
    });

    // 4 세션 user 세팅 (2단계에서 만든 표준 타입)
    req.session.user = {
      credentialId: String(base.credentialId),
      role: base.role,
      deviceType,
    };

    // 5 저장 보장
    await new Promise<void>((resolve, reject) => {
      req.session.save((err: any) => (err ? reject(err) : resolve()));
    });

    // 6 DB에 세션 등록 + 기존 세션 비활성화
    const sessionId = String(req.sessionID);
    const ip =
      String(req.headers['x-forwarded-for'] ?? '')
        .split(',')[0]
        .trim() || String(req.ip ?? '');

    const reg = await this.service.registerSession({
      sessionId,
      credentialId: String(base.credentialId),
      deviceType,
      userAgent: ua,
      ip,
    });

    // 7 기존 세션이 있으면 Redis store에서 세션 삭제(best-effort)
    const store = req.app?.get('sessionStore');
    for (const oldSid of reg.oldSessionIds) {
      // 혹시라도 방금 만든 세션ID가 olds에 섞여있으면 방지
      if (!oldSid || oldSid === sessionId) continue;
      await destroySessionById(store, oldSid);
    }

    return {
      message: '로그인 성공',
      data: {
        credentialId: String(base.credentialId),
        role: base.role,
        deviceType,
        expiresAt: reg.expiresAt.toISOString(),
      },
    };
  }

  /**
   * @remarks
   * https://www.notion.so/2948186df78b80b1864ed84e03a42ef8?source=copy_link
   * 로그아웃
   */
  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles(SystemRole.ADMIN)
  @Post('signout')
  async signout(@Req() req: any) {
    const sid = String(req.sessionID ?? '');

    // 1 DB 비활성화
    if (sid) {
      await this.service.deactivateSessionBySessionId(sid);
    }

    // 2 Redis 세션 제거(현재 세션)
    await new Promise<void>((r) => req.session.destroy(() => r()));

    return { message: '로그아웃', data: null };
  }

  /**
   * @remarks
   * https://www.notion.so/2858186df78b8067bfbde6f65ef898d3?source=copy_link
   * 본인 로그인 확인용 API
   */
  @Get('me')
  @UseGuards(SessionAuthGuard)
  async me(@Req() req: any) {
    const sUser = req.session.user;

    return {
      message: 'me',
      data: {
        credentialId: String(sUser.credentialId),
        role: sUser.role,
        deviceType: sUser.deviceType,
      },
    };
  }

  @Post('admin/reset-password-with-token')
  async resetWithBootstrapToken(@Body() dto: AdminResetDto, @Req() req: any) {
    const token = req.headers['x-bootstrap-token'] as string | undefined;
    const data = await this.service.resetPasswordWithBootstrapToken(
      token,
      dto.email,
      dto.newPassword,
    );
    return { message: '비밀번호 재설정 완료(관리자)', data };
  }

  @Post('admin/force-reset-password')
  async forceResetByAdmin(@Body() dto: AdminResetDto, @Req() req: any) {
    const me = req.session?.user;
    const data = await this.service.forceResetPasswordByAdmin(
      dto.email,
      dto.newPassword,
    );
    return { message: '비밀번호 재설정 완료', data };
  }
}
