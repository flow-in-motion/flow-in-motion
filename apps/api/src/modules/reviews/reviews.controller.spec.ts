import type { Server } from 'node:http';
import {
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantMemberGuard } from '../memberships/policies/tenant-member.guard';
import { UsersService } from '../users/users.service';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

describe('Reviews HTTP boundary', () => {
  let app: INestApplication<Server>;
  const tenant = '33333333-3333-4333-8333-333333333333';
  const record = '55555555-5555-4555-8555-555555555555';
  const service = {
    list: jest.fn(),
    detail: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    saveNote: jest.fn(),
    removeNote: jest.fn(),
  };
  let authenticated = true;
  let member = true;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [ReviewsController],
      providers: [
        { provide: ReviewsService, useValue: service },
        {
          provide: UsersService,
          useValue: {
            findByExternalAuthId: jest.fn().mockResolvedValue({ id: 'caller' }),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: ExecutionContext) => {
          ctx.switchToHttp().getRequest<{ user?: { sub: string } }>().user = {
            sub: 'external-caller',
          };
          return authenticated;
        },
      })
      .overrideGuard(TenantMemberGuard)
      .useValue({ canActivate: () => member })
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });
  beforeEach(() => {
    authenticated = true;
    member = true;
    jest.clearAllMocks();
    service.create.mockResolvedValue({ id: record });
    service.list.mockResolvedValue({ data: [] });
  });
  afterAll(async () => {
    await app.close();
  });
  it('requires both authentication and workspace membership', async () => {
    authenticated = false;
    await request(app.getHttpServer())
      .get(`/api/v1/tenant/${tenant}/reviews/journal`)
      .expect(403);
    authenticated = true;
    member = false;
    await request(app.getHttpServer())
      .get(`/api/v1/tenant/${tenant}/reviews/examination`)
      .expect(403);
    expect(service.list).not.toHaveBeenCalled();
  });
  it('validates each addition protocol and derives ownership from the signed-in user', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/tenant/${tenant}/reviews/examination`)
      .send({ studentName: ' Student ' })
      .expect(201);
    expect(service.create).toHaveBeenLastCalledWith(
      tenant,
      'caller',
      'examination',
      expect.objectContaining({ studentName: 'Student' }),
    );
    await request(app.getHttpServer())
      .post(`/api/v1/tenant/${tenant}/reviews/journal`)
      .send({ manuscriptTitle: 'Title' })
      .expect(201);
    expect(service.create).toHaveBeenLastCalledWith(
      tenant,
      'caller',
      'journal',
      expect.objectContaining({ manuscriptTitle: 'Title' }),
    );
  });
  it('rejects mixed record fields, injected ownership, null names and invalid dates before service writes', async () => {
    for (const body of [
      { manuscriptTitle: 'Title', studentName: 'Wrong protocol' },
      { manuscriptTitle: 'Title', ownerUserId: 'other' },
      { manuscriptTitle: null },
      { manuscriptTitle: 'Title', dueOn: '2027-02-30' },
    ])
      await request(app.getHttpServer())
        .post(`/api/v1/tenant/${tenant}/reviews/journal`)
        .send(body)
        .expect(400);
    expect(service.create).not.toHaveBeenCalled();
  });
  it('rejects invalid kinds, identifiers and pagination', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/tenant/${tenant}/reviews/other`)
      .expect(400);
    await request(app.getHttpServer())
      .get(`/api/v1/tenant/${tenant}/reviews/journal/not-a-uuid`)
      .expect(400);
    await request(app.getHttpServer())
      .get(`/api/v1/tenant/${tenant}/reviews/journal?pageSize=10000`)
      .expect(400);
    expect(service.list).not.toHaveBeenCalled();
    expect(service.detail).not.toHaveBeenCalled();
  });
  it('keeps notes scoped to the kind, record and caller', async () => {
    service.saveNote.mockResolvedValue({ id: 'note' });
    await request(app.getHttpServer())
      .post(`/api/v1/tenant/${tenant}/reviews/examination/${record}/notes`)
      .send({ content: ' First\nSecond ' })
      .expect(201);
    expect(service.saveNote).toHaveBeenCalledWith(
      tenant,
      'caller',
      'examination',
      record,
      'First\nSecond',
    );
    await request(app.getHttpServer())
      .post(`/api/v1/tenant/${tenant}/reviews/examination/${record}/notes`)
      .send({ content: ' ' })
      .expect(400);
    expect(service.saveNote).toHaveBeenCalledTimes(1);
  });
});
