import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

/** Minutes of continuous work before a break reminder (any whole number). */
export const BREAK_WORK_MINUTES_RANGE = { min: 5, max: 240 } as const;
/** How long a break can be, in whole minutes. */
export const BREAK_LENGTH_MINUTES_RANGE = { min: 1, max: 60 } as const;

export class BreakRemindersDto {
  @ApiProperty()
  @IsBoolean()
  enabled!: boolean;

  @ApiProperty({
    minimum: BREAK_WORK_MINUTES_RANGE.min,
    maximum: BREAK_WORK_MINUTES_RANGE.max,
  })
  @IsInt()
  @Min(BREAK_WORK_MINUTES_RANGE.min)
  @Max(BREAK_WORK_MINUTES_RANGE.max)
  workMinutes!: number;

  @ApiProperty({
    minimum: BREAK_LENGTH_MINUTES_RANGE.min,
    maximum: BREAK_LENGTH_MINUTES_RANGE.max,
  })
  @IsInt()
  @Min(BREAK_LENGTH_MINUTES_RANGE.min)
  @Max(BREAK_LENGTH_MINUTES_RANGE.max)
  breakMinutes!: number;

  @ApiProperty({
    description: 'Also show a system notification in the background',
  })
  @IsBoolean()
  notifications!: boolean;

  @ApiProperty({
    required: false,
    description: 'Play a chime with the reminder (on when not set)',
  })
  @IsOptional()
  @IsBoolean()
  sound?: boolean;
}

export class UpdateAccountPreferencesDto {
  @ApiProperty({ required: false, enum: ['light', 'dark'] })
  @IsOptional()
  @IsIn(['light', 'dark'])
  appearanceTheme?: string;

  @ApiProperty({ required: false, enum: ['modern', 'minimal', 'executive'] })
  @IsOptional()
  @IsIn(['modern', 'minimal', 'executive'])
  designTheme?: string;

  @ApiProperty({
    required: false,
    enum: ['ocean', 'violet', 'emerald', 'rose'],
  })
  @IsOptional()
  @IsIn(['ocean', 'violet', 'emerald', 'rose'])
  colorTheme?: string;

  @ApiProperty({ required: false, enum: ['small', 'default', 'large'] })
  @IsOptional()
  @IsIn(['small', 'default', 'large'])
  textSize?: string;

  @ApiProperty({ required: false, type: BreakRemindersDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => BreakRemindersDto)
  breakReminders?: BreakRemindersDto;
}
