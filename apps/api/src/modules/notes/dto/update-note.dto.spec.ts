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
  it.each([true, false])('accepts modulePinned=%s', async (modulePinned) => {
    const dto = Object.assign(new UpdateNoteDto(), { modulePinned });

    expect(await validate(dto)).toEqual([]);
  });

  it.each(['true', 'false', 1, 0, null])(
    'rejects invalid modulePinned=%j',
    async (modulePinned) => {
      const dto = Object.assign(new UpdateNoteDto(), { modulePinned });
      const errors = await validate(dto);

      expect(errors.map((error) => error.property)).toContain('modulePinned');
    },
  );
});
