import { validate } from 'class-validator';
import { ConferenceLinkOptionsQueryDto } from './conference-link-options-query.dto';

describe('ConferenceLinkOptionsQueryDto', () => {
  it.each(['', 'Genome', 'a'.repeat(200)])(
    'accepts a valid search of length %i',
    async (search) => {
      const dto = new ConferenceLinkOptionsQueryDto();
      dto.search = search;

      expect(await validate(dto)).toHaveLength(0);
    },
  );

  it('rejects searches longer than 200 characters', async () => {
    const dto = new ConferenceLinkOptionsQueryDto();
    dto.search = 'a'.repeat(201);

    expect(await validate(dto)).not.toHaveLength(0);
  });

  it('rejects a missing search parameter', async () => {
    expect(
      await validate(new ConferenceLinkOptionsQueryDto()),
    ).not.toHaveLength(0);
  });
});
