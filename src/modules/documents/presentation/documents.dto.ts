import { IsObject, IsOptional, IsString } from 'class-validator';
import { DocumentRecord } from '../domain/models/document.model';

export class IngestTextDocumentDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsString()
  rawText!: string;

  @IsOptional()
  source?: DocumentRecord['source'];

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UploadDocumentDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class GenerateDocumentDto {
  @IsString()
  useCaseId!: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsObject()
  params?: Record<string, unknown>;
}
