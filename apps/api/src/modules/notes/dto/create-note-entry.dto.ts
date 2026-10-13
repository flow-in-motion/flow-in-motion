import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateNoteEntryDto {
  @ApiProperty({
    example: 'Reviewed the latest research findings.',
    description: 'New content to add as an automatically dated note entry.',
  })
  @IsString()
  @IsNotEmpty()
  content!: string;
}
