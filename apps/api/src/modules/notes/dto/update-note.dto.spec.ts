import { validate } from 'class-validator';
import { UpdateNoteDto } from './update-note.dto';

describe('UpdateNoteDto', () => {
  it.each([{}, { followUpDate: '2026-11-20' }, { followUpDate: null }])(
    'accepts valid follow-up date updates: %j',
    async (input) => {
      const dto = Object.assign(new UpdateNoteDto(), input);

      expect(await validate(dto)).toEqual([]);
    },
  );

  it('rejects an invalid follow-up date', async () => {
    const dto = Object.assign(new UpdateNoteDto(), {
      followUpDate: 'not-a-date',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain('followUpDate');
  });
});
