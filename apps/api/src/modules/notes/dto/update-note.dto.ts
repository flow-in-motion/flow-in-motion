import { ApiProperty, OmitType, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsOptional,
  ValidateIf,
} from 'class-validator';
import { CreateNoteDto } from './create-note.dto';

export class UpdateNoteDto extends PartialType(
  OmitType(CreateNoteDto, ['followUpDate'] as const),
) {
  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsDateString()
  followUpDate?: string | null;

  @ApiProperty({ required: false, type: Boolean })
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  modulePinned?: boolean;
}
