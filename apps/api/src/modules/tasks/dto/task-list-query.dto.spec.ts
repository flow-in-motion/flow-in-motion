import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { TaskListQueryDto } from './task-list-query.dto';

describe('TaskListQueryDto', () => {
  it('accepts omitted filters', async () => {
    const dto = plainToInstance(TaskListQueryDto, {});

    expect(await validate(dto)).toEqual([]);
    expect(dto.statuses).toBeUndefined();
    expect(dto.priorities).toBeUndefined();
  });

  it('parses comma-separated selections and trims whitespace', async () => {
    const dto = plainToInstance(TaskListQueryDto, {
      statuses: 'To do, Underway, Waiting',
      priorities: 'High, Critical',
    });

    expect(await validate(dto)).toEqual([]);
    expect(dto.statuses).toEqual(['To do', 'Underway', 'Waiting']);
    expect(dto.priorities).toEqual(['High', 'Critical']);
  });

  it('accepts repeated query parameters', async () => {
    const dto = plainToInstance(TaskListQueryDto, {
      statuses: ['To do', 'Waiting'],
      priorities: ['High', 'Critical'],
    });

    expect(await validate(dto)).toEqual([]);
    expect(dto.statuses).toEqual(['To do', 'Waiting']);
    expect(dto.priorities).toEqual(['High', 'Critical']);
  });

  it('treats empty selections as no filtering', async () => {
    const dto = plainToInstance(TaskListQueryDto, {
      statuses: '',
      priorities: [],
    });

    expect(await validate(dto)).toEqual([]);
    expect(dto.statuses).toEqual([]);
    expect(dto.priorities).toEqual([]);
  });

  it.each([
    { statuses: 'Unknown status' },
    { priorities: 'Urgent' },
    { statuses: { value: 'Complete' } },
    { priorities: 5 },
    { statuses: 'To do,Underway,Waiting,Complete,To do' },
  ])('rejects invalid filters: %j', async (input) => {
    const dto = plainToInstance(TaskListQueryDto, input);

    expect((await validate(dto)).length).toBeGreaterThan(0);
  });
});
