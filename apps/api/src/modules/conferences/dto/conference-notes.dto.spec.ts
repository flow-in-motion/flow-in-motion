import { validate } from 'class-validator';
import { CreateConferenceDto } from './create-conference.dto';
import { UpdateConferenceDto } from './update-conference.dto';

describe.each([
  ['create', CreateConferenceDto],
  ['update', UpdateConferenceDto],
] as const)('%s conference notes', (_label, Dto) => {
  it.each([
    ['omitted', undefined, true],
    ['cleared', null, true],
    ['multiline abstract', 'Background\n\nMethods and findings.', true],
    ['non-text value', 123, false],
    ['oversized text', 'a'.repeat(50001), false],
  ])('%s', async (_description, notes, valid) => {
    const input = Object.assign(new Dto(), {
      name: 'Research conference',
      notes,
    });

    const errors = await validate(input);
    const notesErrors = errors.filter((error) => error.property === 'notes');

    expect(notesErrors.length === 0).toBe(valid);
  });
});
