import { IsArray, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class QueryDto {
  @IsString()
  query!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  entityHints?: string[];
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  libraryIds?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  topK?: number;
}

export class ChunkSourceDto {
  id!: string;
  text!: string;
}

export class GraphFactDto {
  id!: string;
  from!: string;
  relation!: string;
  to!: string;
}

export class QueryResponseDto {
  answer!: string;
  sourcesUsed!: string[];
  fastContext!: ChunkSourceDto[];
  truthFacts!: GraphFactDto[];
  model?: string;
  tokensUsed?: number;
  prompt!: string;
}
