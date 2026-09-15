// apps/api/src/modules/task-invitations/dto/invite-collaborator.dto.ts
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';

export class InviteCollaboratorDto {
  @ApiProperty({ example: 'colleague@example.com' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ example: 'Dr. Colleague Name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'University of Example' })
  @IsOptional()
  @IsString()
  affiliation?: string;
}
