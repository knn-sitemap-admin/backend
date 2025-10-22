import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Req,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { SigninDto } from './dto/signin.dto';
import { BootstrapAdminDto } from './dto/bootstrap-admin.dto';
import { AdminResetDto } from './dto/admin-reset.dto';

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
    const sessionUser = await this.service.signin(dto.email, dto.password);
    req.session.user = sessionUser;
    return {
      message: '로그인 성공',
      data: sessionUser,
    };
  }

  /**
   * @remarks
   * https://www.notion.so/2948186df78b80b1864ed84e03a42ef8?source=copy_link
   * 로그아웃
   */
  @Post('signout')
  async signout(@Req() req: any) {
    await new Promise<void>((r) => req.session.destroy(() => r()));
    return { message: '로그아웃', data: null };
  }

  /**
   * @remarks
   * https://www.notion.so/2858186df78b8067bfbde6f65ef898d3?source=copy_link
   * 본인 로그인 확인용 API
   */
  @Get('me')
  me(@Req() req: any) {
    return {
      message: 'me',
      data: req.session?.user ?? null,
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
    if (!me || me.role !== 'admin') {
      throw new ForbiddenException('관리자만 실행할 수 있습니다.');
    }
    const data = await this.service.forceResetPasswordByAdmin(
      dto.email,
      dto.newPassword,
    );
    return { message: '비밀번호 재설정 완료', data };
  }
}
