import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Response } from 'express';

@Injectable()
export class OwnerSessionGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const http = ctx.switchToHttp();
    const req = http.getRequest<any>();
    const res = http.getResponse<Response>();

    const user = req.session?.user;

    // 로그인 안 됐으면 로그인 페이지로
    if (!user) {
      res.redirect('/owner/login');
      return false;
    }

    // admin만 owner 접근 허용이라면
    if (user.role !== 'admin') {
      res.redirect('/owner/login');
      return false;
    }

    return true;
  }
}
