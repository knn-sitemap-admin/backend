import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SigninDto } from './dto/signin.dto';
import { BootstrapAdminDto } from './dto/bootstrap-admin.dto';

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
   * 상세 명세 작성중
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
}
