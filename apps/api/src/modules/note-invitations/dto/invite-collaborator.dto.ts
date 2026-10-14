// apps/api/src/modules/note-invitations/dto/invite-collaborator.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';

/** Trims strings and treats blank ones as not provided. */
const blankToUndefined = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || undefined : value;

export class InviteCollaboratorDto {
  /** Optional so a collaborator can be recorded by name alone. Required to send an invitation. */
  @ApiPropertyOptional({ example: 'colleague@example.com' })
  @Transform(blankToUndefined)
  @IsOptional()
  @IsEmail()
  email?: string;

  /** Required when no email is given, so every entry has something to identify it. */
  @ApiPropertyOptional({ example: 'Dr. Colleague Name' })
  @Transform(blankToUndefined)
  @ValidateIf(
    (dto: InviteCollaboratorDto) => !dto.email || dto.name !== undefined,
  )
  @IsString()
  @IsNotEmpty({
    message: 'Enter a name or an email address for the collaborator',
  })
  name?: string;

  @ApiPropertyOptional({ example: 'University of Example' })
  @IsOptional()
  @IsString()
  affiliation?: string;
}
