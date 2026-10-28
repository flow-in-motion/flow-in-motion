import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** The longest single entry that can be added by hand: one day. */
export const MAX_TIME_ENTRY_MINUTES = 24 * 60;

export class StartTimerDto {
  @ApiProperty({ description: 'The task to start working on' })
  @IsUUID()
  taskId!: string;
}

/** Time added by hand, for work that wasn't timed. */
export class CreateTimeEntryDto {
  @ApiProperty({
    description: 'When the work happened (ISO 8601 date-time)',
    example: '2026-10-28T09:00:00+11:00',
  })
  @IsDateString()
  startedAt!: string;

  @ApiProperty({ minimum: 1, maximum: MAX_TIME_ENTRY_MINUTES, example: 90 })
  @IsInt()
  @Min(1)
  @Max(MAX_TIME_ENTRY_MINUTES)
  minutes!: number;

  @ApiPropertyOptional({ maxLength: 2000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string | null;
}

export class UpdateTimeEntryDto extends PartialType(CreateTimeEntryDto) {}
