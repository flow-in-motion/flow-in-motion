import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateNoteEntryDto {
  @ApiProperty({
    example: 'Reviewed the latest research findings and corrected the date.',
    description:
      'Replacement content for an existing note entry. Its last-edited date is updated automatically.',
  })
  @IsString()
  @IsNotEmpty()
  content!: string;
}
