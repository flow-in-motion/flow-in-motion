import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateTaskDescriptionEntryDto {
  @ApiProperty({
    example: 'Completed the initial review. Next, compare the findings.',
    description: 'New task description content with an automatic timestamp.',
  })
  @IsString()
  @IsNotEmpty()
  content!: string;
}
