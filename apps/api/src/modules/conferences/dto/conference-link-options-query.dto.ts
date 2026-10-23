import { IsString, Length } from 'class-validator';

export class ConferenceLinkOptionsQueryDto {
  @IsString()
  @Length(0, 200)
  search!: string;
}
