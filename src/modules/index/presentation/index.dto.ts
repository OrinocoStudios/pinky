import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class ReindexDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50000)
  limit?: number;
}
