import { IsOptional, IsString } from 'class-validator';

export class createStatusDto {
  @IsString()
  @IsOptional()
  content: string;

  @IsString()
  @IsOptional()
  fileId: string;
}

export class getStatusDto {
  limit: number;
  page: number;
}
