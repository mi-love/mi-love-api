import { Controller, Get, Head, HttpCode } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  @HttpCode(200)
  health() {
    return { status: 'ok', service: 'mi-love-api' };
  }

  @Head()
  @HttpCode(200)
  healthHead() {
    return;
  }
}
