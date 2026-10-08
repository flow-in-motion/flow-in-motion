import { IsString, Length } from 'class-validator';

export class ConferenceLinkOptionsQueryDto {
  @IsString()
  @Length(1, 200)
  search!: string;
}
