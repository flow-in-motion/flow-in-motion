import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export const MODULE_ARCHIVE_MODES = [
  'archive_contents',
  'move_contents',
] as const;

export type ModuleArchiveMode = (typeof MODULE_ARCHIVE_MODES)[number];

export class ArchiveModuleDto {
  @ApiProperty({
    enum: MODULE_ARCHIVE_MODES,
    example: 'archive_contents',
  })
  @IsString()
  @IsIn(MODULE_ARCHIVE_MODES)
  mode!: ModuleArchiveMode;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  destinationModuleId?: string;
}
