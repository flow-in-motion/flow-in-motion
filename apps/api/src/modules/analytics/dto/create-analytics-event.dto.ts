import { ApiProperty } from '@nestjs/swagger';
import {
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateAnalyticsEventDto {
  @ApiProperty({
    example: 'project_created',
    description:
      'A short, snake_case event name (e.g. "page_view", "task_completed").',
  })
  @IsString()
  @Length(1, 100)
  name!: string;

  @ApiProperty({ required: false, example: '/projects' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  path?: string;

  @ApiProperty({ required: false, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  sessionId?: string;

  @ApiProperty({ required: false, example: 'papers' })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z][a-z0-9_]{0,49}$/)
  pageKey?: string;

  @ApiProperty({ required: false, example: 'documents' })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z][a-z0-9_-]{0,79}$/)
  featureKey?: string;

  @ApiProperty({
    required: false,
    description: 'Small, flat set of extra properties describing the event.',
    example: { projectId: 'a1b2c3' },
  })
  @IsOptional()
  @IsObject()
  properties?: Record<string, string | number | boolean | null>;
}
