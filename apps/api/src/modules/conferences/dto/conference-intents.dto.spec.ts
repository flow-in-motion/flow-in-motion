import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateConferenceDto } from './create-conference.dto';
import { UpdateConferenceDto } from './update-conference.dto';

describe('Conference Presented intent', () => {
  it.each([CreateConferenceDto, UpdateConferenceDto])(
    'accepts Presented alongside other intentions without requiring other fields',
    async (Dto) => {
      const errors = await validate(
        plainToInstance(Dto, {
          name: 'Conference',
          intents: ['Attending', 'Presented'],
        }),
      );
      expect(errors).toHaveLength(0);
    },
  );
  it.each([['Presented', 'Presented'], ['Invalid']])(
    'rejects duplicate or unsupported intentions: %s',
    async (...intents) => {
      expect(
        await validate(
          plainToInstance(CreateConferenceDto, { name: 'Conference', intents }),
        ),
      ).not.toHaveLength(0);
    },
  );
});
