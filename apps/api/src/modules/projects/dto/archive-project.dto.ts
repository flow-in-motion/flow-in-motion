import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export const PROJECT_ARCHIVE_MODES = [
  'archive_contents',
  'move_contents',
] as const;

export type ProjectArchiveMode = (typeof PROJECT_ARCHIVE_MODES)[number];

export class ArchiveProjectDto {
  @ApiProperty({
    enum: PROJECT_ARCHIVE_MODES,
    example: 'archive_contents',
  })
  @IsString()
  @IsIn(PROJECT_ARCHIVE_MODES)
  mode!: ProjectArchiveMode;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  destinationProjectId?: string;
}
