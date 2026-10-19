import { ApiProperty, OmitType, PartialType } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';
import { CreateModuleDto } from './create-module.dto';

export class UpdateModuleDto extends PartialType(
  OmitType(CreateModuleDto, ['assignedToUserId', 'dueDate'] as const),
) {
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
