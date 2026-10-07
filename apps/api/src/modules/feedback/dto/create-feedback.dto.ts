import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

// data: URL + base64 payload, capped well under the 3mb JSON body limit
// (see app.useBodyParser in create-app.ts) to leave room for request overhead.
const SCREENSHOT_DATA_URL_PATTERN = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+=*$/;
const MAX_SCREENSHOT_DATA_URL_LENGTH = 2_800_000;

export class CreateFeedbackDto {
  @ApiProperty({
    example:
      'The project dashboard is easy to use, but loading is sometimes slow.',
  })
  @IsString()
  @Length(2, 2000)
  message!: string;

  @ApiProperty({
    required: false,
    example: 4,
    minimum: 1,
    maximum: 5,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiProperty({
    required: false,
    description:
      'Optional screenshot captured by the client, as a base64 data URL (image/png or image/jpeg).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_SCREENSHOT_DATA_URL_LENGTH)
  @Matches(SCREENSHOT_DATA_URL_PATTERN, {
    message: 'screenshotDataUrl must be a base64 PNG or JPEG data URL',
  })
  screenshotDataUrl?: string;
}
