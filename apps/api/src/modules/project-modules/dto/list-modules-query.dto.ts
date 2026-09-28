import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { ProjectScopedPaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export const MODULE_SORT_FIELDS = [
  'dateAdded',
  'alphabetical',
  'progress',
] as const;
export const SORT_DIRECTIONS = ['asc', 'desc'] as const;

export type ModuleSortField = (typeof MODULE_SORT_FIELDS)[number];
export type SortDirection = (typeof SORT_DIRECTIONS)[number];

export class ListModulesQueryDto extends ProjectScopedPaginationQueryDto {
  @ApiPropertyOptional({ enum: MODULE_SORT_FIELDS, default: 'dateAdded' })
  @IsOptional()
  @IsIn(MODULE_SORT_FIELDS)
  sortBy?: ModuleSortField;

  @ApiPropertyOptional({ enum: SORT_DIRECTIONS, default: 'desc' })
  @IsOptional()
  @IsIn(SORT_DIRECTIONS)
  sortDirection?: SortDirection;
}
