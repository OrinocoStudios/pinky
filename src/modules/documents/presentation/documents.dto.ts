import {
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsNotEmpty,
  ValidateNested,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';

abstract class DocumentSourceBaseDto {
  @IsIn(['upload', 'url', 'generated'])
  kind!: 'upload' | 'url' | 'generated';
}

export class DocumentSourceUploadDto extends DocumentSourceBaseDto {
  @IsIn(['upload'])
  declare kind: 'upload';

  @IsString()
  filename!: string;

  @IsString()
  mimeType!: string;
}

export class DocumentSourceUrlDto extends DocumentSourceBaseDto {
  @IsIn(['url'])
  declare kind: 'url';

  @IsString()
  url!: string;
}

export class DocumentSourceGeneratedDto extends DocumentSourceBaseDto {
  @IsIn(['generated'])
  declare kind: 'generated';

  @IsString()
  useCaseId!: string;
}

export type DocumentSourceDto =
  | DocumentSourceUploadDto
  | DocumentSourceUrlDto
  | DocumentSourceGeneratedDto;

export class IngestTextDocumentDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsString()
  @IsNotEmpty()
  rawText!: string;

  @IsOptional()
  @ValidateIf((o) => o.source != null)
  @ValidateNested()
  @Type(() => DocumentSourceBaseDto, {
    keepDiscriminatorProperty: true,
    discriminator: {
      property: 'kind',
      subTypes: [
        { value: DocumentSourceUploadDto, name: 'upload' },
        { value: DocumentSourceUrlDto, name: 'url' },
        { value: DocumentSourceGeneratedDto, name: 'generated' },
      ],
    },
  })
  source?: DocumentSourceDto;

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
