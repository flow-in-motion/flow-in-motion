import { validate } from 'class-validator';

import { CreateModuleDto, PAPER_STATUSES } from './create-module.dto';
import { UpdateModuleDto } from './update-module.dto';

describe.each([
  ['create', CreateModuleDto],
  ['update', UpdateModuleDto],
] as const)('%s paper status', (_name, Dto) => {
  it.each(PAPER_STATUSES)('accepts %s', async (status) => {
    const dto = Object.assign(new Dto(), {
      shortTitle: 'Test paper',
      status,
    });

    const errors = await validate(dto);

    expect(errors.filter((error) => error.property === 'status')).toHaveLength(
      0,
    );
  });

  it('accepts Review for compatibility with older clients', async () => {
    const dto = Object.assign(new Dto(), {
      shortTitle: 'Test paper',
      status: 'Review',
    });

    const errors = await validate(dto);

    expect(errors.filter((error) => error.property === 'status')).toHaveLength(
      0,
    );
  });

  it.each(['Unknown', 'Archived', 'proposed'])('rejects %s', async (status) => {
    const dto = Object.assign(new Dto(), {
      shortTitle: 'Test paper',
      status,
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'status')).toBe(true);
  });
});
