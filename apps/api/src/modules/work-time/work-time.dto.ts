import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsUUID } from 'class-validator';
export const WORK_TIME_KINDS = ['project', 'note', 'hdr'] as const;
export type WorkTimeKind = (typeof WORK_TIME_KINDS)[number];
export class WorkTimeTargetDto {
  @ApiProperty({ enum: WORK_TIME_KINDS })
  @IsIn(WORK_TIME_KINDS)
  kind!: WorkTimeKind;

  @ApiProperty()
  @IsUUID()
  targetId!: string;
}
