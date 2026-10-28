import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsUUID,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  REMINDER_ITEM_TYPES,
  type ReminderItemType,
} from '../due-reminders.types';

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class DueRemindersQueryDto {
  @ApiProperty({
    description: "Today's date on the person's device",
    example: '2026-10-28',
  })
  @Matches(DAY_PATTERN, { message: 'today must be a date like 2026-10-28' })
  today!: string;
}

export class ReminderRefDto {
  @ApiProperty({ enum: REMINDER_ITEM_TYPES })
  @IsIn(REMINDER_ITEM_TYPES)
  type!: ReminderItemType;

  @ApiProperty()
  @IsUUID()
  itemId!: string;

  @ApiProperty({ example: '2026-11-02' })
  @Matches(DAY_PATTERN, { message: 'dueDate must be a date like 2026-11-02' })
  dueDate!: string;
}

export class SeenReminderDto extends ReminderRefDto {
  @ApiProperty({
    description: 'Days-before stage that was seen; -1 for overdue',
    minimum: -1,
    maximum: 14,
  })
  @IsInt()
  @Min(-1)
  @Max(14)
  stage!: number;
}

export class DismissRemindersDto {
  @ApiProperty({ type: [ReminderRefDto] })
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => ReminderRefDto)
  items!: ReminderRefDto[];
}

export class MarkRemindersSeenDto {
  @ApiProperty({ type: [SeenReminderDto] })
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => SeenReminderDto)
  items!: SeenReminderDto[];
}
