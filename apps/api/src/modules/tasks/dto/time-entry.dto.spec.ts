import { validate } from 'class-validator';
import {
  CreateTimeEntryDto,
  StartTimerDto,
  UpdateTimeEntryDto,
} from './time-entry.dto';

async function errorFields(dto: object) {
  return (await validate(dto)).map((error) => error.property);
}

describe('time entry DTOs', () => {
  it('starts a timer only for a task id', async () => {
    expect(
      await errorFields(
        Object.assign(new StartTimerDto(), {
          taskId: '6f1d6c39-3a51-4c0f-9c55-0f1f3b0e2a11',
        }),
      ),
    ).toEqual([]);
    expect(
      await errorFields(Object.assign(new StartTimerDto(), { taskId: 'x' })),
    ).toEqual(['taskId']);
  });

  it.each([
    ['one minute', 1, true],
    ['a full day', 1440, true],
    ['nothing', 0, false],
    ['more than a day', 1441, false],
    ['part of a minute', 1.5, false],
  ])('adding %s by hand', async (_label, minutes, valid) => {
    const fields = await errorFields(
      Object.assign(new CreateTimeEntryDto(), {
        startedAt: '2026-10-28T09:00:00+11:00',
        minutes,
        note: 'Drafted the introduction',
      }),
    );
    expect(fields.includes('minutes')).toBe(!valid);
  });

  it('needs a real date for time added by hand', async () => {
    const fields = await errorFields(
      Object.assign(new CreateTimeEntryDto(), {
        startedAt: 'yesterday',
        minutes: 30,
      }),
    );
    expect(fields).toEqual(['startedAt']);
  });

  it('lets a correction change just one field', async () => {
    expect(
      await errorFields(Object.assign(new UpdateTimeEntryDto(), { note: 'x' })),
    ).toEqual([]);
  });
});
