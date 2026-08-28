import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/http-exception.filter';
import { validateEnvironment } from './config/environment';

async function bootstrap(): Promise<void> {
  const env = validateEnvironment(process.env);
  const app = await NestFactory.create(AppModule, { bodyParser: true });
  app.setGlobalPrefix('api/v1');
  app.use(helmet());
  app.enableCors({ origin: env.CORS_ORIGINS.split(',').map((origin) => origin.trim()), credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new GlobalExceptionFilter());
  if (env.SWAGGER_ENABLED) {
    const config = new DocumentBuilder().setTitle('ERP Híbrido API').setVersion('1.0').build();
    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
  }
  await app.listen(env.API_PORT, '0.0.0.0');
}

void bootstrap();
