import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateAccountPreferencesDto } from './update-account-preferences.dto';

async function errors(body: object) {
  const dto = plainToInstance(UpdateAccountPreferencesDto, body);
  const result = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return result.map((error) => error.property);
}

describe('break reminder preferences', () => {
  const valid = {
    enabled: true,
    workMinutes: 50,
    breakMinutes: 10,
    notifications: true,
  };

  it.each([
    ['the default', {}],
    ['a Pomodoro rhythm', { workMinutes: 25, breakMinutes: 5 }],
    ['custom times', { workMinutes: 35, breakMinutes: 7 }],
    ['the longest times', { workMinutes: 240, breakMinutes: 60 }],
    ['the sound turned off', { sound: false }],
  ])('accepts %s', async (_label, change) => {
    await expect(
      errors({ breakReminders: { ...valid, ...change } }),
    ).resolves.toEqual([]);
  });

  it.each([
    ['a work interval under 5 minutes', { workMinutes: 4 }],
    ['a work interval over 4 hours', { workMinutes: 241 }],
    ['a break under a minute', { breakMinutes: 0 }],
    ['a break over an hour', { breakMinutes: 61 }],
    ['part of a minute', { workMinutes: 12.5 }],
    ['a sound setting that is not true or false', { sound: 'loud' }],
    ['an on/off that is not true or false', { enabled: 'yes' }],
    ['an unknown setting', { volume: 5 }],
  ])('rejects %s', async (_label, change) => {
    await expect(
      errors({ breakReminders: { ...valid, ...change } }),
    ).resolves.toEqual(['breakReminders']);
  });
});
