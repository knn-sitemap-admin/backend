import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Response } from 'express';

@Injectable()
export class OwnerAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const ctx = context.switchToHttp();
    const req: any = ctx.getRequest();
    const res: Response = ctx.getResponse();

    const user = req.session?.user;

    if (!user || user.role !== 'admin') {
      // 세션이 없거나 admin이 아니면 로그인 페이지로
      res.redirect('/owner/login');
      return false;
    }

    return true;
  }
}
