import { validate } from 'class-validator';
import { UpdateModuleDto } from './update-module.dto';

describe('UpdateModuleDto dueDate', () => {
  it.each([
    ['a date', { dueDate: '2026-11-20' }],
    ['null for clearing', { dueDate: null }],
    ['an omitted date', {}],
  ])('accepts %s', async (_label, input) => {
    const dto = Object.assign(new UpdateModuleDto(), input);

    await expect(validate(dto)).resolves.toEqual([]);
  });

  it('rejects invalid date text', async () => {
    const dto = Object.assign(new UpdateModuleDto(), {
      dueDate: 'not-a-date',
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'dueDate')).toBe(true);
  });
});
