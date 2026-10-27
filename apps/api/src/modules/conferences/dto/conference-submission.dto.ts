import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

/** What kind of thing is being sent in. */
export const CONFERENCE_SUBMISSION_TYPES = [
  'Full paper',
  'Abstract',
  'Poster',
  'PDW',
  'Symposium / Panel',
  'Presentation',
  'Other',
] as const;
export type ConferenceSubmissionType =
  (typeof CONFERENCE_SUBMISSION_TYPES)[number];

/** Where the submission is up to. Matches the database check. */
export const CONFERENCE_SUBMISSION_STATUSES = [
  'Planning',
  'Submitted',
  'Accepted',
  'Rejected',
  'Withdrawn',
  'Presented',
] as const;
export type ConferenceSubmissionStatus =
  (typeof CONFERENCE_SUBMISSION_STATUSES)[number];

/**
 * A submission is a paper, a project, or just a title (for example a PDW
 * that isn't tracked in the app).
 */
export class CreateConferenceSubmissionDto {
  @ApiPropertyOptional({ description: 'The paper being submitted' })
  @IsOptional()
  @IsUUID()
  moduleId?: string;

  @ApiPropertyOptional({ description: 'The project being submitted' })
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional({
    description:
      'Title as submitted. Required when neither a paper nor a project is chosen.',
    maxLength: 1000,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  title?: string | null;

  @ApiPropertyOptional({
    enum: CONFERENCE_SUBMISSION_TYPES,
    nullable: true,
  })
  @IsOptional()
  @IsIn(CONFERENCE_SUBMISSION_TYPES)
  submissionType?: ConferenceSubmissionType | null;

  @ApiPropertyOptional({
    enum: CONFERENCE_SUBMISSION_STATUSES,
    nullable: true,
  })
  @IsOptional()
  @IsIn(CONFERENCE_SUBMISSION_STATUSES)
  status?: ConferenceSubmissionStatus | null;

  @ApiPropertyOptional({
    description: "This submission's own deadline, if it differs",
    example: '2027-01-15',
    nullable: true,
  })
  @IsOptional()
  @IsDateString({ strict: true })
  submissionDue?: string | null;

  @ApiPropertyOptional({ maxLength: 50000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(50000)
  notes?: string | null;
}

/** The paper or project can't be swapped; remove and add a new one instead. */
export class UpdateConferenceSubmissionDto extends PartialType(
  OmitType(CreateConferenceSubmissionDto, ['moduleId', 'projectId'] as const),
) {}
