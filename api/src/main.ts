import 'reflect-metadata';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { cors: false, bodyParser: false });
  app.useBodyParser('json', { limit: '400kb', strict: true });
  const port = Number(process.env.PORT ?? 3001);

  await app.listen(port, '0.0.0.0');
  Logger.log(`API listening on port ${port}`, 'Bootstrap');
}

void bootstrap();
