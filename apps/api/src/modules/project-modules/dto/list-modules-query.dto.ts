import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ProjectScopedPaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export const MODULE_SORT_FIELDS = [
  'dateAdded',
  'alphabetical',
  'progress',
] as const;
export const SORT_DIRECTIONS = ['asc', 'desc'] as const;

export type ModuleSortField = (typeof MODULE_SORT_FIELDS)[number];
export type SortDirection = (typeof SORT_DIRECTIONS)[number];

function toStringArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  return value === undefined ? [] : [value];
}

export class ListModulesQueryDto extends ProjectScopedPaginationQueryDto {
  @ApiPropertyOptional({ enum: MODULE_SORT_FIELDS, default: 'dateAdded' })
  @IsOptional()
  @IsIn(MODULE_SORT_FIELDS)
  sortBy?: ModuleSortField;

  @ApiPropertyOptional({ enum: SORT_DIRECTIONS, default: 'desc' })
  @IsOptional()
  @IsIn(SORT_DIRECTIONS)
  sortDirection?: SortDirection;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toStringArray(value))
  @IsArray()
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  statuses?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toStringArray(value))
  @IsArray()
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  stages?: string[];
}
