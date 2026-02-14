import { Controller, Get, Req, Res } from '@nestjs/common';
import express from 'express';
import { AuthService } from '../dashboard/auth/auth.service';

@Controller('owner')
export class OwnerAuthPageController {
  constructor(private readonly authService: AuthService) {}

  // 로그인 화면
  @Get('login')
  async loginPage(@Req() req: any, @Res() res: any) {
    const me = req.session?.user;
    if (me && me.role === 'admin') {
      // 이미 로그인 되어 있으면 대시보드로
      return res.redirect('/owner');
    }

    return res.render('owner/login'); // views/owner/login.ejs
  }

  // 최초 1회: 관리자 부트스트랩 화면
  @Get('bootstrap-admin')
  async bootstrapAdminPage(@Req() req: any, @Res() res: any) {
    const me = req.session?.user;
    if (me && me.role === 'admin') {
      return res.redirect('/owner');
    }

    const initialized = await this.authService.hasAdminOrAccount1();
    if (initialized) {
      // 이미 관리자/계정1 있으면 회원가입 화면 자체를 막고 로그인으로
      return res.redirect('/owner/login');
    }

    return res.render('owner/bootstrap-admin'); // views/owner/bootstrap-admin.ejs
  }

  // 비밀번호 재설정 화면 (토큰 방식)
  @Get('reset-password')
  async resetPasswordPage(@Req() req: any, @Res() res: any) {
    const me = req.session?.user;
    if (me && me.role === 'admin') {
      // 이미 로그인되어 있으면 여기서 직접 비번 바꾸고 싶을 수도 있으니 그냥 페이지 보여줘도 됨
      return res.render('owner/reset-password');
    }

    // 로그인 안 되어 있어도 토큰만 있으면 재설정 가능
    return res.render('owner/reset-password');
  }
}
