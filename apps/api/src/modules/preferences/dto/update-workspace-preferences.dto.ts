import { ApiProperty } from '@nestjs/swagger';
import { IsObject, IsOptional } from 'class-validator';

export class UpdateWorkspacePreferencesDto {
  @ApiProperty({
    required: false,
    example: {
      order: ['pipeline', 'conferences'],
      hidden: [],
      widths: {
        pipeline: 60,
        conferences: 40,
      },
    },
  })
  @IsOptional()
  @IsObject()
  dashboardLayout?: Record<string, unknown>;

  @ApiProperty({
    required: false,
    example: { projects: ['project', 'status', 'due'] },
  })
  @IsOptional()
  @IsObject()
  tableColumns?: Record<string, unknown>;
}
