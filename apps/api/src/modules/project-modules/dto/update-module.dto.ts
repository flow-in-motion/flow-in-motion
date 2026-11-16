import { ApiProperty, OmitType, PartialType } from '@nestjs/swagger';
import {
  IsDateString,
  IsOptional,
  IsUUID,
  IsArray,
  ArrayMaxSize,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { JournalPublisherDto } from './paper-planning.dto';
import { CreateModuleDto } from './create-module.dto';

export class UpdateModuleDto extends PartialType(
  OmitType(CreateModuleDto, [
    'assignedToUserId',
    'dueDate',
    'projectId',
    'journalPublishers',
  ] as const),
) {
  @ApiProperty({ required: false, type: [JournalPublisherDto] })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => JournalPublisherDto)
  journalPublishers?: JournalPublisherDto[];

  @ApiProperty({
    required: false,
    nullable: true,
    format: 'uuid',
    description:
      'Move the paper to one of your projects, or null to make it independent.',
  })
  @IsOptional()
  @IsUUID()
  projectId?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsUUID()
  assignedToUserId?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsUUID()
  assignedToInvitationId?: string | null;

  @ApiProperty({ required: false, nullable: true, example: '2026-11-20' })
  @IsOptional()
  @IsDateString()
  dueDate?: string | null;
}
