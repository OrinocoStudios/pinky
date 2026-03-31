import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SummarizeMessageDto {
  @IsString()
  @IsNotEmpty()
  role!: string;

  @IsString()
  @IsNotEmpty()
  content!: string;
}

export class SummarizeDto {
  @IsArray()
  messages!: SummarizeMessageDto[];

  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsOptional()
  @IsString()
  libraryId?: string;
}

export class SummarizeResponseDto {
  summary!: string;
}
