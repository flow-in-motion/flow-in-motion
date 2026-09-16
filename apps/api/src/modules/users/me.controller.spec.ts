import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { MeController } from './me.controller';
import { UsersService } from './users.service';

describe('MeController', () => {
  let controller: MeController;
  let usersService: {
    findOrProvisionFromPrincipal: jest.Mock;
    updateProfile: jest.Mock;
  };

  beforeEach(async () => {
    usersService = {
      findOrProvisionFromPrincipal: jest.fn(),
      updateProfile: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [MeController],
      providers: [{ provide: UsersService, useValue: usersService }],
    }).compile();

    controller = moduleRef.get<MeController>(MeController);
  });

  describe('getMe', () => {
    it('returns the mapped user profile for an existing user', async () => {
      usersService.findOrProvisionFromPrincipal.mockResolvedValue({
        id: 'user-uuid-1',
        email: 'real@example.com',
        displayName: 'Real User',
        jobTitle: 'Research Fellow',
        institution: 'Research University',
        department: 'Medical Sciences',
        phone: null,
        researchInterests: null,
        status: 'active',
        externalAuthId: 'supabase-user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const req = {
        user: { sub: 'supabase-user-1', accessToken: 'access-token-1' },
      } as any;
      const result = await controller.getMe(req);

      expect(usersService.findOrProvisionFromPrincipal).toHaveBeenCalledWith(
        req.user,
      );
      expect(result).toEqual({
        id: 'user-uuid-1',
        email: 'real@example.com',
        displayName: 'Real User',
        jobTitle: 'Research Fellow',
        institution: 'Research University',
        department: 'Medical Sciences',
        phone: null,
        researchInterests: null,
        status: 'active',
        profileComplete: true,
        missingProfileFields: [],
      });
    });

    it('provisions and returns a new user on first login', async () => {
      usersService.findOrProvisionFromPrincipal.mockResolvedValue({
        id: 'user-uuid-2',
        email: 'real2@example.com',
        displayName: 'New User',
        jobTitle: null,
        institution: null,
        department: null,
        phone: null,
        researchInterests: null,
        status: 'active',
        externalAuthId: 'supabase-user-2',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const req = {
        user: { sub: 'supabase-user-2', accessToken: 'access-token-2' },
      } as any;
      const result = await controller.getMe(req);

      expect(result.email).toBe('real2@example.com');
      expect(result.displayName).toBe('New User');
      expect(result.profileComplete).toBe(false);
      expect(result.missingProfileFields).toEqual([
        'jobTitle',
        'institution',
        'department',
      ]);
    });

    it('throws NotFoundException when the user could not be found or provisioned', async () => {
      usersService.findOrProvisionFromPrincipal.mockResolvedValue(undefined);

      const req = {
        user: { sub: 'supabase-user-3', accessToken: 'access-token-3' },
      } as any;

      await expect(controller.getMe(req)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateMe', () => {
    it('updates and returns a completed profile', async () => {
      usersService.findOrProvisionFromPrincipal.mockResolvedValue({
        id: 'user-uuid-1',
      });
      usersService.updateProfile.mockResolvedValue({
        id: 'user-uuid-1',
        email: 'real@example.com',
        displayName: 'Dr Real User',
        jobTitle: 'Research Fellow',
        institution: 'Research University',
        department: 'Medical Sciences',
        phone: '+61 400 000 000',
        researchInterests: 'Clinical trials',
        status: 'active',
      });

      const req = {
        user: { sub: 'supabase-user-1', accessToken: 'access-token-1' },
      } as any;
      const input = {
        displayName: 'Dr Real User',
        jobTitle: 'Research Fellow',
        institution: 'Research University',
        department: 'Medical Sciences',
      };

      const result = await controller.updateMe(req, input);

      expect(usersService.updateProfile).toHaveBeenCalledWith(
        'user-uuid-1',
        input,
      );
      expect(result.profileComplete).toBe(true);
      expect(result.missingProfileFields).toEqual([]);
    });
  });
});
