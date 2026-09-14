import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';

export class CreateSubmissionDto {
  @ApiProperty({ example: '2026-03-01' })
  @IsDateString()
  submittedDate!: string;

  @ApiProperty({ example: 'Nature Communications' })
  @IsString()
  @Length(1, 300)
  journalName!: string;

  @ApiProperty({ example: 'Submitted' })
  @IsString()
  @Length(1, 100)
  status!: string;

  @ApiProperty({ required: false, example: 2 })
  @IsOptional()
  @IsInt()
  @Min(0)
  revisionRounds?: number;

  @ApiProperty({ required: false, example: '2026-06-15' })
  @IsOptional()
  @IsDateString()
  decisionDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}
