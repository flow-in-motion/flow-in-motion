import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

export const FUNDING_STATUSES = [
  'Considering',
  'Preparing',
  'Submitted',
  'Awarded',
  'Unsuccessful',
] as const;

export class CreateFundingDto {
  @ApiProperty({ example: 'Australian Research Council' })
  @IsString()
  @Length(1, 200)
  fundingBody!: string;

  @ApiPropertyOptional({ example: 'Discovery Projects', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  scheme?: string | null;

  @ApiPropertyOptional({
    example: 'University A; Industry Partner B',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  partners?: string | null;

  @ApiPropertyOptional({ example: '250000.00', nullable: true })
  @IsOptional()
  @IsString()
  @Matches(/^\d{1,12}(\.\d{1,2})?$/)
  amount?: string | null;

  @ApiPropertyOptional({ example: 'AUD', nullable: true })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string | null;

  @ApiPropertyOptional({ example: '2027-03-15', nullable: true })
  @IsOptional()
  @IsDateString()
  applicationDeadline?: string | null;

  @ApiPropertyOptional({ example: '2027-03-22', nullable: true })
  @IsOptional()
  @IsDateString()
  followUpDate?: string | null;

  @ApiPropertyOptional({ enum: FUNDING_STATUSES, nullable: true })
  @IsOptional()
  @IsIn(FUNDING_STATUSES)
  status?: (typeof FUNDING_STATUSES)[number] | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @ApiPropertyOptional({ nullable: true, deprecated: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string | null;

  @ApiPropertyOptional({ type: [String], default: [] })
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  projectIds: string[] = [];

  @ApiPropertyOptional({ type: [String], default: [] })
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  moduleIds: string[] = [];
}
