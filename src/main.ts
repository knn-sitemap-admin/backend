import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import morgan from 'morgan';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { HttpExceptionFilter } from './common/http-exception/http-exception.filter';
import { TransformInterceptor } from './common/transform/transform.interceptor';
import session from 'express-session';
import { RedisStore } from 'connect-redis';
import { createClient, type RedisClientType } from 'redis';
import { join } from 'path';
import express from 'express';
import expressLayouts from 'express-ejs-layouts';

import { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const expressApp = app.getHttpAdapter().getInstance();

  const isProd = process.env.NODE_ENV === 'production';

  app.setBaseViewsDir(join(__dirname, '..', 'views'));
  app.setViewEngine('ejs');

  app.use(expressLayouts);
  expressApp.set('layout', 'layouts/main');

  // 정적파일 제공 (css/js/img)
  app.use('/static', express.static(join(__dirname, '..', 'static')));

  // main.ts (부팅 직후)
  app.getHttpAdapter().getInstance().set('etag', false);

  // main.ts (미들웨어로 캐시 금지 + Vary 헤더)
  app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Vary', 'Origin, Cookie, Authorization');
    next();
  });

  //배포
  app.getHttpAdapter().getInstance().set('trust proxy', true);

  //보안 헤더
  app.use(
    helmet({
      crossOriginResourcePolicy: {
        policy: process.env.IS_DEV === 'true' ? 'cross-origin' : 'same-origin',
      },
    }),
  );

  const corsOrigins = (process.env.PAGE_URL ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  // 로컬 테스트용 origin을 코드에서만 추가
  const devExtraOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ];

  const finalOrigins = isProd
    ? corsOrigins
    : Array.from(new Set([...corsOrigins, ...devExtraOrigins]));

  app.enableCors({
    origin: (origin, callback) => {
      // 프론트엔드 도메인들 허용
      const allowedOrigins = [
        process.env.PAGE_URL,
        'http://localhost:3000',
        'http://localhost:3050',
      ].filter(Boolean);

      if (!origin || allowedOrigins.some(ao => origin.includes(ao as string))) {
        callback(null, true);
      } else {
        callback(null, true); // 운영 편의를 위한 전체 허용 (배포 초기 단계)
      }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Accept, Authorization, x-bootstrap-token',
    credentials: true,
    exposedHeaders: ['Authorization'],
  });

  // 요청 로깅 (간소화된 커스텀 포맷)
  app.use(
    morgan((tokens, req, res) => {
      const ua = tokens['user-agent'](req, res) || '';
      const isMobile = /mobile|android|iphone|ipad/i.test(ua) ? 'Mobile' : 'PC';

      let browser = 'Browser';
      if (ua.includes('Firefox')) browser = 'Firefox';
      else if (ua.includes('Edg')) browser = 'Edge';
      else if (ua.includes('Chrome')) browser = 'Chrome';
      else if (ua.includes('Safari')) browser = 'Safari';

      return [
        `[${tokens.method(req, res)}]`,
        tokens.url(req, res),
        `(${tokens.status(req, res)})`,
        '-',
        browser,
        `(${isMobile})`,
      ].join(' ');
    }),
  );

  //전역 파이프
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  //전역 예외 필터/성공 응답 인터셉터
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  // 로컬 개발(IS_DEV=true)이면 MemoryStore 사용 (Redis 불필요)
  // 프로덕션이면 RedisStore 사용
  const isDevMode = process.env.IS_DEV === 'true';

  let store: session.Store;

  if (isDevMode) {
    store = new session.MemoryStore();
  } else {
    //node-redis 클라이언트
    const redisUrl = process.env.REDIS_URL;
    const redisClient: RedisClientType = redisUrl
      ? createClient({ url: redisUrl })
      : createClient({
        socket: {
          host: process.env.REDIS_HOST ?? 'localhost',
          port: Number(process.env.REDIS_PORT ?? 6379),
        },
        password: process.env.REDIS_PASSWORD || undefined,
      });

    redisClient.on('error', (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('Redis Client Error:', msg);
    });
    await redisClient.connect();
    logger.log('[Session] RedisStore 사용 (프로덕션)');

    expressApp.set('redisClient', redisClient);

    type RedisStoreCtorArg = ConstructorParameters<typeof RedisStore>[0];
    store = new RedisStore({
      client: redisClient,
      prefix: 'sess:',
    } satisfies RedisStoreCtorArg);
  }

  expressApp.set('sessionStore', store);

  const ttlHours = Number(process.env.SESSION_TTL_HOURS ?? 6);
  const ttlMs = 1000 * 60 * 60 * (Number.isFinite(ttlHours) ? ttlHours : 6);

  // 운영 환경 판별 강화
  const isActualProd = process.env.NODE_ENV === 'production' || process.env.IS_DEV !== 'true';

  const sessionMiddleware = session({
    store,
    secret: process.env.SESSION_SECRET ?? 'change_this_secret',
    resave: false,
    saveUninitialized: false,
    rolling: true,
    proxy: true,
    cookie: {
      httpOnly: true,
      secure: isActualProd, 
      sameSite: isActualProd ? 'none' : 'lax', 
      path: '/',
      maxAge: ttlMs,
    },
  });

  app.use(sessionMiddleware);

  //스웨거
  const config = new DocumentBuilder()
    .setTitle('NoteApp API')
    .setDescription('API docs')
    .setVersion('version 1.0')
    .build();
  const doc = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, doc);

  await app.listen(Number(process.env.PORT ?? 3050));
}
bootstrap();
