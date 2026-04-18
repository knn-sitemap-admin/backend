import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import * as crypto from 'crypto';
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

    // 5.1 수동 쿠키 설정 (express-session 자동 메커니즘이 NestJS와 충돌하는 경우 대비)
    const secretStr = process.env.SESSION_SECRET ?? 'change_this_secret';
    const secrets = secretStr.split(',').map(s => s.trim()).filter(Boolean);
    const primarySecret = secrets[0];
    
    // express-session의 cookie-signature 방식 (s:sessionid.sig)
    const sig = crypto
      .createHmac('sha256', primarySecret)
      .update(req.sessionID)
      .digest('base64')
      .replace(/=+$/, '');
      
    const ttlHours = Number(process.env.SESSION_TTL_HOURS ?? 6);
    const maxAge = 1000 * 60 * 60 * (Number.isFinite(ttlHours) ? ttlHours : 6);

    const origin = String(req.headers.origin ?? '');
    const isLocalhost = 
      origin.includes('localhost') || 
      origin.includes('127.0.0.1') ||
      req.hostname === 'localhost' ||
      req.hostname === '127.0.0.1' ||
      req.hostname.startsWith('192.168.') ||
      req.hostname.startsWith('10.');

    /**
     * [iPhone/Safari 대응]
     * SameSite: None은 크로스 사이트(다른 도메인)일 때만 필요하지만 Safari ITP가 이를 차단하는 경우가 많음.
     * 프론트와 백엔드가 같은 도메인(예: *.notemap.kr)을 공유한다면 Lax가 훨씬 유리함.
     */
    let cookieSameSite: 'lax' | 'none' | 'strict' = 'lax';
    let cookieSecure = false;

    if (process.env.NODE_ENV === 'production' && !isLocalhost) {
      cookieSecure = true;
      // 프론트엔드가 Railway 업스트림 도메인 등을 사용하여 완전히 다른 도메인일 때만 none 사용
      // 만약 커스텀 도메인을 쓴다면 기본적으로 lax가 더 안전함
      const isCrossDomain = origin && !origin.includes('notemap') && !origin.includes('railway.app');
      cookieSameSite = isCrossDomain ? 'none' : 'lax';
    }

    req.res.cookie('connect.sid', `s:${req.sessionID}.${sig}`, {
      httpOnly: true,
      secure: cookieSecure,
      sameSite: cookieSameSite,
      path: '/',
      maxAge,
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
        accessToken: base.accessToken,
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

  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles(SystemRole.ADMIN)
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
