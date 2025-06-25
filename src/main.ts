import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

const PORT = 9999; // temp removed port to debug why it's at 4545 even though env is set to 9999
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(PORT, () => {
    console.log(`😉 Server is running on port http://localhost:${PORT}`);
  });
}
void bootstrap();
