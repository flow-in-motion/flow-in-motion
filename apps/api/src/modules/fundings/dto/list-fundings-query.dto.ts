import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export const FUNDING_SORT_FIELDS = [
  'fundingBody',
  'scheme',
  'partners',
  'amount',
  'applicationDeadline',
  'followUpDate',
  'status',
  'links',
] as const;
export const FUNDING_SORT_DIRECTIONS = ['asc', 'desc'] as const;

export type FundingSortField = (typeof FUNDING_SORT_FIELDS)[number];
export type FundingSortDirection = (typeof FUNDING_SORT_DIRECTIONS)[number];

export class ListFundingsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: FUNDING_SORT_FIELDS })
  @IsOptional()
  @IsIn(FUNDING_SORT_FIELDS)
  sortBy?: FundingSortField;

  @ApiPropertyOptional({ enum: FUNDING_SORT_DIRECTIONS })
  @IsOptional()
  @IsIn(FUNDING_SORT_DIRECTIONS)
  sortDirection?: FundingSortDirection;
}
