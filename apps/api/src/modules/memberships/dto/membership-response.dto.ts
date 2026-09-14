import { ApiProperty } from '@nestjs/swagger';

export class MembershipResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  tenantId!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty({ format: 'email' })
  email!: string;

  @ApiProperty()
  displayName!: string;

  @ApiProperty({ enum: ['owner', 'limited_member'] })
  role!: string;

  @ApiProperty({ enum: ['active', 'revoked'] })
  status!: string;

  @ApiProperty()
  invitedAt!: Date;

  @ApiProperty({ nullable: true })
  joinedAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty({ nullable: true })
  affiliation!: string | null;
}
