import { ApiProperty, OmitType, PartialType } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';
import { CreateNoteDto } from './create-note.dto';

export class UpdateNoteDto extends PartialType(
  OmitType(CreateNoteDto, ['followUpDate'] as const),
) {
  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsDateString()
  followUpDate?: string | null;
}
