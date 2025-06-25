/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule } from '@nestjs/swagger';
import { DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';

const PORT = 9999; // temp removed port to debug why it's at 4545 even though env is set to 9999
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // swagger does setup
  const config = new DocumentBuilder()
    .setTitle('Mi-Love API')
    .setDescription('Mi-Love API')
    .setVersion('1.0')
    .addTag('mi-love')
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, documentFactory);

  app.useGlobalPipes(new ValidationPipe());
  await app.listen(PORT, () => {
    console.log(`😉 Server is running on port http://localhost:${PORT}`);
  });
}
void bootstrap();
