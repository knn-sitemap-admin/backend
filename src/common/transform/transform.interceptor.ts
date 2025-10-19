import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

interface OkBody {
  success?: boolean;
  messages?: string[] | string;
  data?: unknown;
}

@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    const req = ctx.switchToHttp().getRequest();
    const path = req?.originalUrl ?? req?.url ?? '';

    return next.handle().pipe(
      map((body: OkBody | any) => {
        if (body && typeof body === 'object' && 'success' in body) return body;

        const messages =
          body && typeof body === 'object' && 'messages' in body
            ? (body.messages as any)
            : undefined;

        const data =
          body && typeof body === 'object' && 'data' in body ? body.data : body;

        return {
          success: true,
          path,
          ...(messages
            ? { messages: Array.isArray(messages) ? messages : [messages] }
            : {}),
          ...(data !== undefined ? { data } : {}),
        };
      }),
    );
  }
}
