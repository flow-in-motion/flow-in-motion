import { ApiProperty, OmitType, PartialType } from '@nestjs/swagger';
import {
  IsDateString,
  IsNumberString,
  IsOptional,
  IsString,
} from 'class-validator';
import { CreateProjectDto } from './create-project.dto';

export class UpdateProjectDto extends PartialType(
  OmitType(CreateProjectDto, [
    'researchArea',
    'scheduledFor',
    'dueDate',
    'totalBudget',
  ] as const),
) {
  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  researchArea?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsDateString()
  scheduledFor?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsDateString()
  dueDate?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsNumberString()
  totalBudget?: string | null;
}
