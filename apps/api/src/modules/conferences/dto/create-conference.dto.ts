import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';

export class CreateConferenceDto {
  @ApiPropertyOptional({ example: 'ASM', nullable: true })
  @IsOptional()
  @IsString()
  @Length(2, 20)
  acronym?: string | null;

  @ApiProperty({
    example: 'Australasian Society for Microbiology Conference 2027',
  })
  @IsString()
  @Length(2, 200)
  name!: string;

  @ApiPropertyOptional({ example: 'Sydney, Australia', nullable: true })
  @IsOptional()
  @IsString()
  @Length(2, 200)
  location?: string | null;

  @ApiPropertyOptional({ example: '2026-08-01', nullable: true })
  @IsOptional()
  @IsDateString()
  submissionDue?: string | null;

  @ApiPropertyOptional({ example: '2027-06-04', nullable: true })
  @IsOptional()
  @IsDateString()
  startDate?: string | null;

  @ApiPropertyOptional({ example: '2027-06-08', nullable: true })
  @IsOptional()
  @IsDateString()
  endDate?: string | null;

  @ApiPropertyOptional({ example: 'Abstract', nullable: true })
  @IsOptional()
  @IsString()
  @Length(2, 100)
  submissionType?: string | null;

  @ApiProperty({
    type: [String],
    description: 'Projects linked to this conference',
    required: false,
  })
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  projectIds: string[] = [];

  @ApiProperty({
    type: [String],
    description: 'Papers linked to this conference',
    required: false,
  })
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  moduleIds: string[] = [];
}
