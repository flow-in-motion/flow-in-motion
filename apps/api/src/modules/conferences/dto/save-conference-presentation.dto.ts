import {
  IsDateString,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class SaveConferencePresentationDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Presentation date must use YYYY-MM-DD',
  })
  @IsDateString({ strict: true })
  presentedDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  presentationType?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  paperTitle?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50000)
  abstract?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50000)
  notes?: string | null;
}
