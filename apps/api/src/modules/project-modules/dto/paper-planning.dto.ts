import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateNested,
  ValidateIf,
  Matches,
} from 'class-validator';

export class JournalPublisherDto {
  @ApiProperty()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @Length(1, 300)
  journalName!: string;

  @ApiProperty()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @Length(1, 300)
  publisher!: string;
}

/** Optional planning and reference fields; independent of deadlines and timers. */
export class PaperPlanningDto {
  @ApiPropertyOptional({ nullable: true, example: '2027-01-12' })
  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  workingDate?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 1.5 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(24)
  plannedHours?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
    require_tld: false,
    disallow_auth: true,
  })
  @MaxLength(2048)
  manuscriptUrl?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
    require_tld: false,
    disallow_auth: true,
  })
  @MaxLength(2048)
  dataUrl?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
    require_tld: false,
    disallow_auth: true,
  })
  @MaxLength(2048)
  otherFilesUrl?: string | null;

  @ApiPropertyOptional({ type: [JournalPublisherDto] })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => JournalPublisherDto)
  journalPublishers?: JournalPublisherDto[];
}
