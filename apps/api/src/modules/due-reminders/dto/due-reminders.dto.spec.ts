import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  DismissRemindersDto,
  DueRemindersQueryDto,
  MarkRemindersSeenDto,
} from './due-reminders.dto';

async function errors(Dto: new () => object, body: object) {
  return (
    await validate(plainToInstance(Dto, body), {
      whitelist: true,
      forbidNonWhitelisted: true,
    })
  ).map((error) => error.property);
}

const ITEM = {
  type: 'task',
  itemId: '6f1d6c39-3a51-4c0f-9c55-0f1f3b0e2a11',
  dueDate: '2026-11-02',
  stage: 1,
};

describe('due reminder DTOs', () => {
  it('needs today as a plain date', async () => {
    await expect(
      errors(DueRemindersQueryDto, { today: '2026-10-28' }),
    ).resolves.toEqual([]);
    await expect(
      errors(DueRemindersQueryDto, { today: '28/10/2026' }),
    ).resolves.toEqual(['today']);
  });

  it('accepts seen reminders', async () => {
    await expect(
      errors(MarkRemindersSeenDto, { items: [ITEM] }),
    ).resolves.toEqual([]);
  });

  it.each([
    ['an unknown kind of item', { type: 'meeting' }],
    ['a stage beyond two weeks', { stage: 30 }],
    ['an id that is not a uuid', { itemId: 'x' }],
  ])('rejects %s', async (_label, change) => {
    await expect(
      errors(MarkRemindersSeenDto, { items: [{ ...ITEM, ...change }] }),
    ).resolves.toEqual(['items']);
  });

  it('dismisses several reminders at once', async () => {
    const { stage: _stage, ...ref } = ITEM;
    await expect(
      errors(DismissRemindersDto, { items: [ref, { ...ref, type: 'note' }] }),
    ).resolves.toEqual([]);
    await expect(
      errors(DismissRemindersDto, { items: [{ ...ref, dueDate: 'soon' }] }),
    ).resolves.toEqual(['items']);
  });
});
