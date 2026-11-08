import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export enum ReviewKind {
  Journal = 'journal',
  Examination = 'examination',
}
export const DEGREE_TYPES = ['PhD', 'MRes', 'Masters', 'Other'] as const;
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

class ReviewDatesDto {
  @ApiPropertyOptional({ nullable: true, example: '2027-01-15' })
  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  requestedOn?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '2027-02-15' })
  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dueOn?: string | null;
}

export class JournalReviewFieldsDto extends ReviewDatesDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  manuscriptTitle!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  journalName?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  manuscriptReference?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  journalRanking?: string | null;
}

export class ExaminationFieldsDto extends ReviewDatesDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  studentName!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  studentNumber?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  supervisorName1?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  supervisorName2?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  universityName?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  school?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  thesisTitle?: string | null;

  @ApiPropertyOptional({ nullable: true, enum: DEGREE_TYPES })
  @IsOptional()
  @IsIn(DEGREE_TYPES)
  degreeType?: (typeof DEGREE_TYPES)[number] | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Fee including currency, if known',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  fee?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  abstract?: string | null;
}

export class CreateJournalReviewDto extends JournalReviewFieldsDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  initialNote?: string | null;
}
export class CreateExaminationDto extends ExaminationFieldsDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  initialNote?: string | null;
}
export class UpdateJournalReviewDto extends PartialType(
  JournalReviewFieldsDto,
  { skipNullProperties: false },
) {}
export class UpdateExaminationDto extends PartialType(ExaminationFieldsDto, {
  skipNullProperties: false,
}) {}
export class SaveReviewNoteDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(20000)
  content!: string;
}
