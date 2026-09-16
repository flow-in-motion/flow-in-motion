import { Test, TestingModule } from '@nestjs/testing';
import { HealthCheckService } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { DrizzleService } from '../../db/drizzle.service';

describe('HealthController', () => {
  let controller: HealthController;
  let healthCheckService: HealthCheckService;
  let drizzle: { checkConnection: jest.Mock };

  beforeEach(async () => {
    drizzle = { checkConnection: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthCheckService,
          useValue: {
            check: jest.fn(),
          },
        },
        {
          provide: DrizzleService,
          useValue: drizzle,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    healthCheckService = module.get<HealthCheckService>(HealthCheckService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('checkLiveness', () => {
    it('should call health.check with an empty array', async () => {
      const mockResult = { status: 'ok', info: {}, error: {}, details: {} };
      (healthCheckService.check as jest.Mock).mockResolvedValue(mockResult);

      const result = await controller.checkLiveness();

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(healthCheckService.check).toHaveBeenCalledWith([]);
      expect(result).toEqual(mockResult);
    });
  });

  describe('checkReadiness', () => {
    it('should call health.check with the postgres indicator', async () => {
      const mockResult = {
        status: 'ok',
        info: { postgres: { status: 'up' } },
        error: {},
        details: {},
      };
      (healthCheckService.check as jest.Mock).mockImplementation(
        async (indicators: Array<() => Promise<any>>) => {
          // Execute the indicator function so checkPostgres is exercised too.
          for (const indicator of indicators) {
            await indicator();
          }
          return mockResult;
        },
      );
      drizzle.checkConnection.mockResolvedValue(undefined);

      const result = await controller.checkReadiness();

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(healthCheckService.check).toHaveBeenCalledTimes(1);
      expect(drizzle.checkConnection).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockResult);
    });
  });

  describe('checkPostgres (private, via checkReadiness)', () => {
    it('should return status up when connection and query succeed', async () => {
      drizzle.checkConnection.mockResolvedValue(undefined);

      (healthCheckService.check as jest.Mock).mockImplementation(
        async (indicators: Array<() => Promise<any>>) => {
          const results = await Promise.all(indicators.map((fn) => fn()));
          return { status: 'ok', results };
        },
      );
      const result: any = await controller.checkReadiness();

      expect(result.results[0]).toEqual({ postgres: { status: 'up' } });
    });

    it('should throw an error when the Postgres connection fails', async () => {
      drizzle.checkConnection.mockRejectedValue(
        new Error('connection refused'),
      );

      (healthCheckService.check as jest.Mock).mockImplementation(
        async (indicators: Array<() => Promise<any>>) => {
          // only invoke the postgres indicator (index 0) for this test
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return
          return indicators[0]!();
        },
      );

      await expect(controller.checkReadiness()).rejects.toThrow(
        'Postgres check failed: connection refused',
      );
      expect(drizzle.checkConnection).toHaveBeenCalledTimes(1);
    });
  });
});
