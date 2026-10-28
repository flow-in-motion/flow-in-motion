import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
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

/** How many days before a due date a reminder can come. */
export const DUE_REMINDER_LEAD_DAYS = [0, 1, 2, 3, 7, 14] as const;
/** What due-date reminders can cover. */
export const DUE_REMINDER_TYPES = [
  'tasks',
  'papers',
  'projects',
  'events',
  'funding',
  'notes',
] as const;

export class DueRemindersDto {
  @ApiProperty({ enum: DUE_REMINDER_LEAD_DAYS, isArray: true })
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(DUE_REMINDER_LEAD_DAYS.length)
  @IsIn(DUE_REMINDER_LEAD_DAYS, { each: true })
  leadDays!: number[];

  @ApiProperty({ description: 'Keep reminding about overdue items' })
  @IsBoolean()
  overdue!: boolean;

  @ApiProperty({ enum: DUE_REMINDER_TYPES, isArray: true })
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(DUE_REMINDER_TYPES.length)
  @IsIn(DUE_REMINDER_TYPES, { each: true })
  types!: string[];
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

  @ApiProperty({ required: false, type: DueRemindersDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => DueRemindersDto)
  dueReminders?: DueRemindersDto;
}
