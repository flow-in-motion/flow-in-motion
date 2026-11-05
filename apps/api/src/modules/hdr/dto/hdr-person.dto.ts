import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export const HDR_TYPES = ['PhD', 'MRes', 'Visiting scholar'] as const;
export const HDR_CATEGORIES = ['Current', 'Potential'] as const;

export class CreateHdrPersonDto {
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
  @MaxLength(1000)
  researchTopic?: string | null;

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

// Undefined means unchanged; null is permitted only on the optional text fields.
export class UpdateHdrPersonDto extends PartialType(CreateHdrPersonDto, {
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
