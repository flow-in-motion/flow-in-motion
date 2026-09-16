import { ConfigService } from '@nestjs/config';
import { CalendarEventsController } from './calendar-events.controller';
import { CalendarEventsService } from '../services/calendar-events.service';
import { UsersService } from '../../users/users.service';

describe('CalendarEventsController', () => {
  let controller: CalendarEventsController;

  let calendarEventsService: {
    list: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
  };

  let usersService: {
    findByExternalAuthId: jest.Mock;
  };

  let configService: {
    get: jest.Mock;
  };

  beforeEach(() => {
    calendarEventsService = {
      list: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    usersService = {
      findByExternalAuthId: jest.fn().mockResolvedValue({ id: 'user-1' }),
    };

    configService = {
      get: jest.fn().mockReturnValue(20),
    };

    controller = new CalendarEventsController(
      calendarEventsService as unknown as CalendarEventsService,
      usersService as unknown as UsersService,
      configService as unknown as ConfigService,
    );
  });

  const req = {
    user: {
      sub: 'supabase-user-1',
      accessToken: 'token-1',
    },
  } as any;

  describe('list', () => {
    it('delegates with the tenant and pagination parameters', async () => {
      const response = {
        data: [{ id: 'event-1' }],
        meta: { page: 2, pageSize: 20, totalItems: 21, totalPages: 2 },
      };

      calendarEventsService.list.mockResolvedValue(response);

      const result = await controller.list('tenant-1', { page: 2 });

      expect(configService.get).toHaveBeenCalledWith('PAGE_SIZE', 20);
      expect(calendarEventsService.list).toHaveBeenCalledWith(
        'tenant-1',
        2,
        20,
      );
      expect(result).toBe(response);
    });
  });

  describe('create', () => {
    it('resolves the caller and delegates to the service', async () => {
      calendarEventsService.create.mockResolvedValue({ id: 'event-1' });

      const dto = { title: 'Lab booking closes', eventDate: '2026-09-15' };
      const result = await controller.create('tenant-1', req, dto);

      expect(usersService.findByExternalAuthId).toHaveBeenCalledWith(
        'supabase-user-1',
      );
      expect(calendarEventsService.create).toHaveBeenCalledWith(
        'tenant-1',
        'user-1',
        dto,
      );
      expect(result).toEqual({ id: 'event-1' });
    });
  });

  describe('update', () => {
    it('resolves the caller and delegates to the service', async () => {
      calendarEventsService.update.mockResolvedValue({ id: 'event-1' });

      const dto = { title: 'Updated title' };
      const result = await controller.update('tenant-1', 'event-1', req, dto);

      expect(calendarEventsService.update).toHaveBeenCalledWith(
        'tenant-1',
        'event-1',
        'user-1',
        dto,
      );
      expect(result).toEqual({ id: 'event-1' });
    });
  });

  describe('remove', () => {
    it('resolves the caller and delegates to the service', async () => {
      calendarEventsService.remove.mockResolvedValue({
        message: 'Calendar event deleted successfully',
      });

      const result = await controller.remove('tenant-1', 'event-1', req);

      expect(calendarEventsService.remove).toHaveBeenCalledWith(
        'tenant-1',
        'event-1',
        'user-1',
      );
      expect(result).toEqual({
        message: 'Calendar event deleted successfully',
      });
    });
  });
});
