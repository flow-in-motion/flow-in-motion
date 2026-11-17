import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEmail,
  IsDateString,
  IsNotEmpty,
  Matches,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export const HDR_TYPES = ['PhD', 'MRes', 'Visiting scholar'] as const;
export const HDR_SUPERVISION_TYPES = [
  'Primary',
  'Associate',
  'Co-supervisor',
  'Panel',
  'Other',
] as const;
export const HDR_CATEGORIES = ['Current', 'Potential'] as const;

export class HdrPersonFieldsDto {
  @ApiProperty()
  @IsString()
  @Length(1, 200)
  name!: string;

  @ApiPropertyOptional({ enum: HDR_TYPES, default: 'PhD' })
  @ValidateIf((_o, v: unknown) => v !== undefined)
  @IsIn(HDR_TYPES)
  type?: (typeof HDR_TYPES)[number];

  @ApiPropertyOptional({ enum: HDR_CATEGORIES, default: 'Current' })
  @ValidateIf((_o, v: unknown) => v !== undefined)
  @IsIn(HDR_CATEGORIES)
  category?: (typeof HDR_CATEGORIES)[number];

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsEmail()
  @MaxLength(320)
  email?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  researchTopic?: string | null;

  @ApiPropertyOptional({ nullable: true, enum: HDR_SUPERVISION_TYPES })
  @IsOptional()
  @IsIn(HDR_SUPERVISION_TYPES)
  supervisionType?: (typeof HDR_SUPERVISION_TYPES)[number] | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  submissionDueDate?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  conferences?: string | null;

  @ApiPropertyOptional({ type: [String] })
  @ValidateIf((_o, v: unknown) => v !== undefined)
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  projectIds?: string[];

  @ApiPropertyOptional({ type: [String] })
  @ValidateIf((_o, v: unknown) => v !== undefined)
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  paperIds?: string[];
}

export class CreateHdrPersonDto extends HdrPersonFieldsDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  initialDiscussionNote?: string | null;
}

export class SaveHdrNoteDto {
  @ApiProperty()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(20000)
  content!: string;
}

// Undefined means unchanged; null clears an optional supervision or contact field.
export class UpdateHdrPersonDto extends PartialType(HdrPersonFieldsDto, {
  skipNullProperties: false,
}) {}

export class ListHdrPeopleDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: HDR_TYPES })
  @IsOptional()
  @IsIn(HDR_TYPES)
  type?: (typeof HDR_TYPES)[number];

  @ApiPropertyOptional({ enum: HDR_CATEGORIES })
  @IsOptional()
  @IsIn(HDR_CATEGORIES)
  category?: (typeof HDR_CATEGORIES)[number];
}
