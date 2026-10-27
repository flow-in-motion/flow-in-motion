import { validate } from 'class-validator';
import { CreateConferenceDto } from './create-conference.dto';
import { UpdateConferenceDto } from './update-conference.dto';

describe.each([
  ['create', CreateConferenceDto],
  ['update', UpdateConferenceDto],
] as const)('%s conference event type', (_label, Dto) => {
  it.each([
    ['omitted (stays a conference)', undefined, true],
    ['conference', 'Conference', true],
    ['research seminar', 'Research seminar', true],
    ['journal special issue', 'Journal special issue', true],
    ['unknown kind', 'Webinar', false],
  ])('%s', async (_description, eventType, valid) => {
    const input = Object.assign(new Dto(), {
      name: 'Research event',
      eventType,
    });

    const errors = await validate(input);
    const typeErrors = errors.filter((error) => error.property === 'eventType');

    expect(typeErrors.length === 0).toBe(valid);
  });
});
