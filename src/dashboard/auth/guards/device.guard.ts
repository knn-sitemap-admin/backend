import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DEVICES_KEY } from '../decorators/devices.decorator';

@Injectable()
export class DeviceGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const allowed = this.reflector.getAllAndOverride<('pc' | 'mobile')[]>(
      DEVICES_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );

    if (!allowed || allowed.length === 0) return true;

    const req = ctx.switchToHttp().getRequest();
    const deviceType = req.session?.user?.deviceType as
      | 'pc'
      | 'mobile'
      | undefined;

    if (deviceType && allowed.includes(deviceType)) return true;
    throw new ForbiddenException('허용되지 않은 기기에서 접근했습니다');
  }
}
