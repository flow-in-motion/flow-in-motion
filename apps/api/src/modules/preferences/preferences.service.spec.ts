import {
  BreakRemindersDto,
  DueRemindersDto,
} from './dto/update-account-preferences.dto';
import { PreferencesRepository } from './preferences.repository';
import { PreferencesService } from './preferences.service';

describe('PreferencesService', () => {
  const repository = {
    findAccount: jest.fn(),
    updateAccount: jest.fn(),
    findWorkspace: jest.fn(),
    updateWorkspace: jest.fn(),
  };
  const service = new PreferencesService(
    repository as unknown as PreferencesRepository,
  );

  beforeEach(() => jest.clearAllMocks());

  it('returns null until account preferences have been created', async () => {
    repository.findAccount.mockResolvedValue(undefined);
    await expect(service.getAccount('user-1')).resolves.toBeNull();
  });

  it('saves validated account preference values', async () => {
    const preferences = {
      appearanceTheme: 'dark',
      designTheme: 'minimal',
      colorTheme: 'violet',
      textSize: 'large',
    };
    repository.updateAccount.mockResolvedValue({ preferences });

    await expect(service.updateAccount('user-1', preferences)).resolves.toEqual(
      preferences,
    );
    expect(repository.updateAccount).toHaveBeenCalledWith(
      'user-1',
      preferences,
    );
  });

  it('saves break reminder settings alongside display preferences', async () => {
    repository.updateAccount.mockImplementation(
      (_userId: string, preferences: unknown) => ({ preferences }),
    );
    const breakReminders = Object.assign(new BreakRemindersDto(), {
      enabled: true,
      workMinutes: 25,
      breakMinutes: 5,
      notifications: false,
    });

    await service.updateAccount('user-1', { breakReminders });

    expect(repository.updateAccount).toHaveBeenCalledWith('user-1', {
      breakReminders: {
        enabled: true,
        workMinutes: 25,
        breakMinutes: 5,
        notifications: false,
      },
    });
  });

  it('keeps the chime setting when it is sent', async () => {
    repository.updateAccount.mockImplementation(
      (_userId: string, preferences: unknown) => ({ preferences }),
    );
    const breakReminders = Object.assign(new BreakRemindersDto(), {
      enabled: true,
      workMinutes: 50,
      breakMinutes: 10,
      notifications: true,
      sound: false,
    });

    await service.updateAccount('user-1', { breakReminders });

    expect(repository.updateAccount).toHaveBeenCalledWith('user-1', {
      breakReminders: expect.objectContaining({ sound: false }),
    });
  });

  it('saves due reminder settings, latest reminder last', async () => {
    repository.updateAccount.mockImplementation(
      (_userId: string, preferences: unknown) => ({ preferences }),
    );
    const dueReminders = Object.assign(new DueRemindersDto(), {
      leadDays: [0, 7, 1],
      overdue: false,
      types: ['tasks'],
    });

    await service.updateAccount('user-1', { dueReminders });

    expect(repository.updateAccount).toHaveBeenCalledWith('user-1', {
      dueReminders: { leadDays: [7, 1, 0], overdue: false, types: ['tasks'] },
    });
  });

  it('sanitizes workspace layouts and ignores unknown table keys', async () => {
    repository.updateWorkspace.mockImplementation(
      (_userId: string, _tenantId: string, preferences: unknown) => ({
        preferences,
      }),
    );

    const result = await service.updateWorkspace('user-1', 'tenant-1', {
      dashboardLayout: {
        order: ['summary', 'summary', 42],
        hidden: ['conferences'],
      },
      tableColumns: {
        projects: ['due', 'due', 'status'],
        unsafeTable: ['secret'],
      },
    });

    expect(result).toEqual({
      dashboardLayout: {
        order: ['summary'],
        hidden: ['conferences'],
      },
      tableColumns: {
        projects: ['due', 'status'],
      },
    });
  });
  it('saves dynamic widget widths and discards invalid values', async () => {
    repository.updateWorkspace.mockImplementation(
      (_userId: string, _tenantId: string, preferences: unknown) => ({
        preferences,
      }),
    );

    const result = await service.updateWorkspace('user-1', 'tenant-1', {
      dashboardLayout: {
        order: ['stalled-papers', 'task-health'],
        hidden: [],
        widths: {
          'stalled-papers': 35,
          'task-health': 65,
          pipeline: 50.5,
          conferences: 100,
          tasks: 24,
          'priority-workload': '50',
          unknownWidget: 50,
        },
      },
    });

    expect(result).toEqual({
      dashboardLayout: {
        order: ['stalled-papers', 'task-health'],
        hidden: [],
        widths: {
          'stalled-papers': 35,
          'task-health': 65,
          pipeline: 51,
          conferences: 100,
        },
      },
    });
  });

  it('allows resetting custom widths without changing visibility or order', async () => {
    repository.updateWorkspace.mockImplementation(
      (_userId: string, _tenantId: string, preferences: unknown) => ({
        preferences,
      }),
    );

    const result = await service.updateWorkspace('user-1', 'tenant-1', {
      dashboardLayout: {
        order: ['pipeline', 'conferences'],
        hidden: ['conferences'],
        widths: {},
      },
    });

    expect(result).toEqual({
      dashboardLayout: {
        order: ['pipeline', 'conferences'],
        hidden: ['conferences'],
        widths: {},
      },
    });
  });
});
