import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  IsUrl,
} from 'class-validator';

export const CONFERENCE_INTENTS = [
  'Considering',
  'Submitting',
  'Attending',
] as const;

export type ConferenceIntent = (typeof CONFERENCE_INTENTS)[number];

/**
 * Any time-bounded thing with a submission deadline: a conference, a
 * workshop, a research seminar talk, a journal special issue's call for
 * papers, or something else. Matches the database check.
 */
export const CONFERENCE_EVENT_TYPES = [
  'Conference',
  'Workshop',
  'Research seminar',
  'Journal special issue',
  'Other',
] as const;

export type ConferenceEventType = (typeof CONFERENCE_EVENT_TYPES)[number];

export class CreateConferenceDto {
  @ApiPropertyOptional({ example: 'ASM', nullable: true })
  @IsOptional()
  @IsString()
  @Length(2, 20)
  acronym?: string | null;

  @ApiPropertyOptional({
    enum: CONFERENCE_EVENT_TYPES,
    default: 'Conference',
    description: 'What kind of event or call this is',
  })
  @IsOptional()
  @IsIn(CONFERENCE_EVENT_TYPES)
  eventType?: ConferenceEventType;

  @ApiProperty({
    example: 'Australasian Society for Microbiology Conference 2027',
  })
  @IsString()
  @Length(2, 200)
  name!: string;

  @ApiPropertyOptional({ example: 'Sydney, Australia', nullable: true })
  @IsOptional()
  @IsString()
  @Length(2, 200)
  location?: string | null;

  @ApiPropertyOptional({
    example: 'https://conference.example.org',
    description: 'Conference website URL, including http:// or https://',
    maxLength: 2048,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
    require_valid_protocol: true,
    disallow_auth: true,
  })
  websiteUrl?: string | null;

  @ApiPropertyOptional({
    description: 'Free-text notes or an abstract for the conference',
    maxLength: 50000,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50000)
  notes?: string | null;

  @ApiPropertyOptional({ example: '2026-08-01', nullable: true })
  @IsOptional()
  @IsDateString()
  submissionDue?: string | null;

  @ApiPropertyOptional({ example: '2027-06-04', nullable: true })
  @IsOptional()
  @IsDateString()
  startDate?: string | null;

  @ApiPropertyOptional({ example: '2027-06-08', nullable: true })
  @IsOptional()
  @IsDateString()
  endDate?: string | null;

  @ApiPropertyOptional({ example: 'Abstract', nullable: true })
  @IsOptional()
  @IsString()
  @Length(2, 100)
  submissionType?: string | null;

  @ApiProperty({
    type: [String],
    enum: CONFERENCE_INTENTS,
    description: 'How the user plans to engage with the conference',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(CONFERENCE_INTENTS, { each: true })
  intents?: ConferenceIntent[] = [];

  @ApiProperty({
    type: [String],
    description: 'Projects linked to this conference',
    required: false,
  })
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  projectIds: string[] = [];

  @ApiProperty({
    type: [String],
    description: 'Papers linked to this conference',
    required: false,
  })
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  moduleIds: string[] = [];
}
