import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as dotenv from 'dotenv';
dotenv.config();
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Extra origins can be added without a redeploy via CORS_ORIGINS
  // (comma-separated), so a new frontend domain is a config change.
  const allowedOrigins = [
    'https://flexee-2-adv.vercel.app',
    'http://localhost:3000',
    'http://localhost:3001',
    ...(process.env.CORS_ORIGINS || '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  ];

  app.enableCors({
    origin: (origin, callback) => {
      // Reject by returning false, not by throwing: a thrown error surfaces as
      // a 500 with no CORS headers, which the browser reports as an opaque
      // CORS failure rather than a blocked origin.
      callback(null, !origin || allowedOrigins.includes(origin));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    // Headers must be listed explicitly. Per the Fetch spec, `Authorization`
    // is never covered by the `*` wildcard, so `allowedHeaders: '*'` passed
    // preflight for login (Content-Type only) and then failed it for every
    // authenticated request that follows.
    allowedHeaders: [
      'Authorization',
      'Content-Type',
      'Accept',
      'Origin',
      'X-Requested-With',
    ],
    credentials: true,
  });

  app.setGlobalPrefix(process.env.GLOBAL_PREFIX || 'api');

  const config = new DocumentBuilder()
    .setTitle('Flexee 2.0 Backend API')
    .setDescription('API documentation for Flexee 2.0 backend')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      'JWT',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
