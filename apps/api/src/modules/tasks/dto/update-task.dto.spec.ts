import { validate } from 'class-validator';
import { UpdateTaskDto } from './update-task.dto';

describe('UpdateTaskDto planning fields', () => {
  it.each([
    {},
    { dueDate: '2026-11-20' },
    { dueDate: null },
    { estimatedHours: '3.5' },
    { estimatedHours: '0' },
    { estimatedHours: null },
  ])('accepts valid optional values: %j', async (input) => {
    const dto = Object.assign(new UpdateTaskDto(), input);

    await expect(validate(dto)).resolves.toEqual([]);
  });

  it.each([
    { field: 'dueDate', value: 'not-a-date' },
    { field: 'estimatedHours', value: 'not-a-number' },
  ])('rejects invalid $field', async ({ field, value }) => {
    const dto = Object.assign(new UpdateTaskDto(), {
      [field]: value,
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === field)).toBe(true);
  });
});
