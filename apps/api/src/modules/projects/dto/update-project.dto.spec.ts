import { validate } from 'class-validator';
import { UpdateProjectDto } from './update-project.dto';

describe('UpdateProjectDto', () => {
  it.each([
    {},
    { researchArea: 'Biochemistry' },
    { scheduledFor: '2026-11-20' },
    { dueDate: '2026-12-01' },
    { totalBudget: '7500' },
    { totalBudget: '0' },
    { researchArea: null },
    { scheduledFor: null },
    { dueDate: null },
    { totalBudget: null },
  ])('accepts valid optional values: %j', async (input) => {
    const dto = Object.assign(new UpdateProjectDto(), input);

    await expect(validate(dto)).resolves.toEqual([]);
  });

  it.each([
    { field: 'researchArea', value: 123 },
    { field: 'scheduledFor', value: 'not-a-date' },
    { field: 'dueDate', value: 'not-a-date' },
    { field: 'totalBudget', value: 'not-a-number' },
  ])('rejects invalid $field', async ({ field, value }) => {
    const dto = Object.assign(new UpdateProjectDto(), {
      [field]: value,
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === field)).toBe(true);
  });
});
