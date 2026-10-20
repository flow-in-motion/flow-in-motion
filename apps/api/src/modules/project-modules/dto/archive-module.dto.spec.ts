import { validate } from 'class-validator';
import { ArchiveModuleDto } from './archive-module.dto';

describe('ArchiveModuleDto', () => {
  it.each([
    { mode: 'archive_contents' },
    {
      mode: 'move_contents',
      destinationModuleId: '123e4567-e89b-42d3-a456-426614174000',
    },
  ])('accepts valid options: %j', async (input) => {
    const dto = Object.assign(new ArchiveModuleDto(), input);

    expect(await validate(dto)).toEqual([]);
  });

  it.each([undefined, null, 'delete_everything'])(
    'rejects invalid mode: %j',
    async (mode) => {
      const dto = Object.assign(new ArchiveModuleDto(), { mode });
      const errors = await validate(dto);

      expect(errors.map((error) => error.property)).toContain('mode');
    },
  );

  it('rejects an invalid destination id', async () => {
    const dto = Object.assign(new ArchiveModuleDto(), {
      mode: 'move_contents',
      destinationModuleId: 'not-a-uuid',
    });
    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain(
      'destinationModuleId',
    );
  });
});
