import { Global, Module } from '@nestjs/common';
import { DbService } from './database.service';

@Global()
@Module({
  providers: [DbService],
  exports: [DbService],
})
export class DatabaseModule {}
