import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Min } from 'class-validator';

export class PaginationQueryDto {
  @ApiPropertyOptional({ example: 1, minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;
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
}
