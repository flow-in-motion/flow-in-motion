import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsUUID, ValidateIf } from 'class-validator';

export class ArchiveProjectDto {
  @ApiProperty({ enum: ['archive', 'move'] })
  @IsIn(['archive', 'move'])
  contentAction!: 'archive' | 'move';

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Required when contentAction is move.',
  })
  @ValidateIf((value: ArchiveProjectDto) => value.contentAction === 'move')
  @IsUUID()
  destinationProjectId?: string;
}
