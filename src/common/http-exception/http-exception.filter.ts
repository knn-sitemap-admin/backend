import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { sendDiscordNotification } from '../utils/discord-notifier.util';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  async catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<any>();
    const res = ctx.getResponse();

    const isViewRequest = req.url?.startsWith('/owner');
    const path = req?.originalUrl ?? req?.url ?? '';
    const method = req?.method;
    const user = req.session?.user;

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

    // 에러 로그 구성
    const errorLog = {
      method,
      path,
      status,
      messages,
      user: user ? { id: user.credentialId, role: user.role } : 'anonymous',
      body: req.body,
      query: req.query,
      stack: exception instanceof Error ? exception.stack : String(exception),
    };

    // 1. 서버 콘솔 로깅 (상세히)
    if (status >= 500) {
      this.logger.error(
        `[SYSTEM ERROR] ${method} ${path} (${status})\n` +
        `- Messages: ${messages.join(', ')}\n` +
        `- User: ${JSON.stringify(errorLog.user)}\n` +
        `- Body: ${JSON.stringify(req.body)}\n` +
        `- Stack: ${errorLog.stack}`,
      );
    } else {
      this.logger.warn(`[HTTP ERROR] ${method} ${path} (${status}) - ${messages.join(', ')}`);
    }

    // 2. 디스코드 알림 (500 에러 이상일 경우에만)
    const discordUrl = process.env.DISCORD_WEBHOOK_URL;
    if (status >= 500 && discordUrl) {
      void sendDiscordNotification(discordUrl, {
        title: `🚨 [${process.env.NODE_ENV || 'prod'}] Server Error (${status})`,
        description: `**${method} ${path}**\n${messages.join('\n')}`,
        fields: [
          { name: 'User', value: JSON.stringify(errorLog.user), inline: true },
          { name: 'Request Body', value: `\`\`\`json\n${JSON.stringify(req.body, null, 2).slice(0, 1000)}\n\`\`\`` },
          { name: 'Stack Trace', value: `\`\`\`text\n${errorLog.stack?.slice(0, 1000)}\n\`\`\`` },
        ],
        color: 0xff0000,
      });
    }

    // 3. 응답 전송
    if (isViewRequest) {
      // 뷰 요청인 경우 에러 페이지 렌더링 (원하는 경우)
      return res.status(status).render('owner/error', {
        status,
        message: messages[0],
      });
    }

    res.status(status).json({
      success: false,
      path,
      messages,
      statusCode: status,
    });
  }
}
