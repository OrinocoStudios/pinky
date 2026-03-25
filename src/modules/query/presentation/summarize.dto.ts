import { IsArray, IsNotEmpty, IsString } from 'class-validator';

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
}

export class SummarizeResponseDto {
  summary!: string;
}
