import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { request, response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request & { originalUrl?: string }>();
    const res = ctx.getResponse();

    if (req.url.startsWith('/owner')) {
      console.error('[VIEW ERROR]', exception);
      return;
    }

    const path = (req?.originalUrl as string) ?? (req as any)?.url ?? '';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let messages: string[] = ['internal server error'];

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const resp = exception.getResponse();
      if (typeof resp === 'string') {
        messages = [resp];
      } else if (typeof resp === 'object' && resp) {
        const msg = (resp as any).message;
        if (Array.isArray(msg)) messages = msg;
        else if (msg) messages = [String(msg)];
        else messages = [exception.message];
      } else {
        messages = [exception.message];
      }
    }

    res.status(status).json({
      success: false,
      path,
      messages,
      statusCode: status,
    });
  }
}
