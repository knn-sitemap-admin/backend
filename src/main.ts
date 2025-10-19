import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import morgan from 'morgan';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { HttpExceptionFilter } from './common/http-exception/http-exception.filter';
import { TransformInterceptor } from './common/transform/transform.interceptor';
import session from 'express-session';
import { RedisStore } from 'connect-redis';
import { createClient, type RedisClientType } from 'redis';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  //보안 헤더
  app.use(helmet());

  //요청 로깅
  app.use(morgan('combined'));

  //CORS
  app.enableCors({
    origin: ['*', true],
    credentials: true,
  });

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

  //node-redis 클라이언트
  const redisClient: RedisClientType = createClient({
    socket: {
      host: process.env.REDIS_HOST ?? 'localhost',
      port: Number(process.env.REDIS_PORT ?? 6379),
    },
    password: process.env.REDIS_PASSWORD || undefined,
  });

  redisClient.on('error', (err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.error('Redis Client Error:', msg);
  });

  await redisClient.connect();

  type RedisStoreCtorArg = ConstructorParameters<typeof RedisStore>[0];

  const store = new RedisStore({
    client: redisClient,
    prefix: 'sess:',
  } satisfies RedisStoreCtorArg);

  app.use(
    session({
      store,
      secret: process.env.SESSION_SECRET ?? 'change_this_secret',
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: process.env.SESSION_COOKIE_SECURE === 'true',
        maxAge: 1000 * 60 * 60 * 24 * 7,
      },
    }),
  );

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
