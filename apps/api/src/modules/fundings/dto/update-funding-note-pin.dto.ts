import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateFundingNotePinDto {
  @ApiProperty({ type: Boolean })
  @IsBoolean()
  pinned!: boolean;
}
