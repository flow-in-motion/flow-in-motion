import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateIf } from 'class-validator';

export class PaginationQueryDto {
  @ApiPropertyOptional({ example: 1, minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ oneOf: [{ type: 'integer', minimum: 1, maximum: 100 }, { type: 'string', enum: ['all'] }] })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => value === 'all' ? value : Number(value))
  @ValidateIf((_object, value: unknown) => value !== 'all')
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number | 'all';

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

}

/**
 * Global `ValidationPipe` config sets `forbidNonWhitelisted: true`, so any
 * query param not declared on the `@Query()`-bound DTO is rejected — a
 * controller that reads `projectId` via a separate `@Query('projectId')`
 * param alongside `@Query() query: PaginationQueryDto` still 400s, because
 * validation runs against the DTO's own declared shape only.
 */
export class ProjectScopedPaginationQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => value === 'true' ? true : value === 'false' ? false : value)
  @IsBoolean()
  projectOnly?: boolean;
}
