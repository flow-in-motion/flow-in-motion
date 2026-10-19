import { ApiProperty, OmitType, PartialType } from '@nestjs/swagger';
import { IsDateString, IsNumberString, IsOptional } from 'class-validator';
import { CreateTaskDto } from './create-task.dto';

export class UpdateTaskDto extends PartialType(
  OmitType(CreateTaskDto, ['dueDate', 'estimatedHours'] as const),
) {
  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsDateString()
  dueDate?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsNumberString()
  estimatedHours?: string | null;
}
