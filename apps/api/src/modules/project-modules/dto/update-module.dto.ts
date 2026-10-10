import { ApiProperty, OmitType, PartialType } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { CreateModuleDto } from './create-module.dto';

export class UpdateModuleDto extends PartialType(
  OmitType(CreateModuleDto, ['assignedToUserId'] as const),
) {
  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsUUID()
  assignedToUserId?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsUUID()
  assignedToInvitationId?: string | null;
}
