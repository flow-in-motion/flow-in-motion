import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

interface CreateAppOptions {
  enableScheduler?: boolean;
}

export async function createApp(
  options: CreateAppOptions = {},
): Promise<INestApplication> {
  const rootModule = options.enableScheduler
    ? (await import('./scheduled-app.module')).ScheduledAppModule
    : AppModule;

  const app = await NestFactory.create(rootModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const configService = app.get(ConfigService);
  const appUrl = configService.getOrThrow<string>('APP_URL');
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api/docs')) {
      return next();
    }

    return helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'", appUrl],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
    })(req, res, next);
  });

  app.enableCors({
    origin: [appUrl],
    credentials: false,
    allowedHeaders: ['Authorization', 'Content-Type'],
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Research Tracker API')
      .setDescription('Workspace, membership, and project management API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  return app;
}
