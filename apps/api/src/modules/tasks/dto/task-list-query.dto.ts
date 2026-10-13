import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsOptional } from 'class-validator';
import { ProjectScopedPaginationQueryDto } from '../../../common/dto/pagination-query.dto';

function parseSelections(value: unknown): unknown {
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (Array.isArray(value)) {
    return value.flatMap((item: unknown) =>
      typeof item === 'string'
        ? item
            .split(',')
            .map((part) => part.trim())
            .filter(Boolean)
        : [item],
    );
  }

  return value;
}

export class TaskListQueryDto extends ProjectScopedPaginationQueryDto {
  @ApiPropertyOptional({
    type: String,
    example: 'To do,Underway,Waiting',
    description: 'Comma-separated task statuses. Omit to include all.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => parseSelections(value))
  @IsArray()
  @ArrayMaxSize(4)
  @IsIn(['To do', 'Underway', 'Waiting', 'Complete'], { each: true })
  statuses?: string[];

  @ApiPropertyOptional({
    type: String,
    example: 'High,Critical',
    description: 'Comma-separated priorities. Omit to include all.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => parseSelections(value))
  @IsArray()
  @ArrayMaxSize(4)
  @IsIn(['Low', 'Medium', 'High', 'Critical'], { each: true })
  priorities?: string[];
}
