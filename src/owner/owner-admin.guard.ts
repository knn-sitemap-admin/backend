import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request, Response } from 'express';

@Injectable()
export class OwnerAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request & { session?: any }>();
    const res = ctx.getResponse<Response>();

    const me = req.session?.user;

    console.log('[OwnerAdminGuard] session user =', me);

    if (!me || me.role !== 'admin') {
      res.redirect('/owner/login');
      return false;
    }

    return true;
  }
}
