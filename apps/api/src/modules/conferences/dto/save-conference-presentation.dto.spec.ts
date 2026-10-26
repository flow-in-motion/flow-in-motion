import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { SaveConferencePresentationDto } from './save-conference-presentation.dto';

describe('SaveConferencePresentationDto', () => {
  it('accepts a presentation date and optional details', async () => {
    const dto = plainToInstance(SaveConferencePresentationDto, {
      presentedDate: '2026-10-01',
      presentationType: 'Poster',
      paperTitle: 'Burnout contagion',
      abstract: 'The abstract presented at this conference.',
      notes: null,
    });

    expect(await validate(dto)).toHaveLength(0);
  });

  it.each([
    {},
    { presentedDate: null },
    { presentedDate: '2026-02-30' },
    { presentedDate: '01/10/2026' },
    { presentedDate: '2026-10-01T12:00:00Z' },
  ])('rejects a missing or invalid date: %j', async (input) => {
    const dto = plainToInstance(SaveConferencePresentationDto, input);

    expect((await validate(dto)).length).toBeGreaterThan(0);
  });

  it('rejects non-text presentation details', async () => {
    const dto = plainToInstance(SaveConferencePresentationDto, {
      presentedDate: '2026-10-01',
      abstract: { unexpected: 'object' },
    });

    expect((await validate(dto)).length).toBeGreaterThan(0);
  });
});
