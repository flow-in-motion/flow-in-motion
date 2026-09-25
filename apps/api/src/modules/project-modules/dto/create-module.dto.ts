// apps/api/src/modules/project-modules/dto/create-module.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';

export class CreateModuleDto {
  @ApiProperty({
    example: 'Kinase paper',
    description:
      'The working name used day-to-day, often before a formal title exists.',
  })
  @IsString()
  @Length(1, 200)
  shortTitle!: string;

  @ApiProperty({
    required: false,
    example: 'Draft Manuscript',
    description: 'The formal title, often added later in the process.',
  })
  @IsOptional()
  @IsString()
  @Length(2, 300)
  title?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    required: false,
    description: "The paper's academic abstract.",
  })
  @IsOptional()
  @IsString()
  abstract?: string;

  @ApiProperty({
    required: false,
    example: 'Nature Communications',
    description: 'The primary journal this paper is being targeted for.',
  })
  @IsOptional()
  @IsString()
  targetJournal?: string;

  @ApiProperty({
    required: false,
    example: 'Scientific Reports',
    description: 'A fallback journal if the target journal does not work out.',
  })
  @IsOptional()
  @IsString()
  backupJournal?: string;

  @ApiProperty({
    required: false,
    example: 'ICML',
    description: 'The primary conference this paper is being targeted for.',
  })
  @IsOptional()
  @IsString()
  targetConference?: string;

  @ApiProperty({
    required: false,
    example: 'NeurIPS Workshop',
    description:
      'A fallback conference if the target conference does not work out.',
  })
  @IsOptional()
  @IsString()
  backupConference?: string;

  @ApiProperty({
    format: 'uuid',
    description:
      'The owned project this paper belongs to.',
  })
  @IsUUID()
  projectId!: string;

  @ApiProperty({
    required: false,
    example: 'Active',
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiProperty({
    required: false,
    example: 'Concept & Ideation',
  })
  @IsOptional()
  @IsString()
  pipelineStage?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  assignedToUserId?: string;

  @ApiProperty({
    required: false,
    example: '2027-06-01',
    description: 'Paper due date in ISO date format',
  })
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
