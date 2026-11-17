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
import { HdrController } from './hdr.controller';
import { HdrService } from './hdr.service';

describe('HDR supervision HTTP boundary', () => {
  let app: INestApplication<Server>;
  const tenant = '33333333-3333-4333-8333-333333333333';
  const person = '55555555-5555-4555-8555-555555555555';
  const note = '66666666-6666-4666-8666-666666666666';
  const base = `/api/v1/tenant/${tenant}/hdr-people`;
  const service = {
    counts: jest.fn().mockResolvedValue({
      currentStudents: 31,
      potentialStudents: 7,
      visitingScholars: 2,
    }),
    create: jest.fn(),
    update: jest.fn(),
    notes: jest.fn(),
    saveNote: jest.fn(),
    removeNote: jest.fn(),
  };
  let authenticated = true,
    member = true;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [HdrController],
      providers: [
        { provide: HdrService, useValue: service },
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
    service.notes.mockResolvedValue([]);
  });
  afterAll(async () => {
    await app.close();
  });

  it('requires authentication and membership for discussion notes', async () => {
    authenticated = false;
    await request(app.getHttpServer())
      .get(`${base}/${person}/notes`)
      .expect(403);
    authenticated = true;
    member = false;
    await request(app.getHttpServer())
      .post(`${base}/${person}/notes`)
      .send({ content: 'Text' })
      .expect(403);
    expect(service.notes).not.toHaveBeenCalled();
    expect(service.saveNote).not.toHaveBeenCalled();
  });
  it('resolves application ownership and scopes all note operations to the parent', async () => {
    await request(app.getHttpServer())
      .get(`${base}/${person}/notes`)
      .expect(200);
    expect(service.notes).toHaveBeenCalledWith(tenant, person, 'caller');
    await request(app.getHttpServer())
      .post(`${base}/${person}/notes`)
      .send({ content: ' New note ' })
      .expect(201);
    expect(service.saveNote).toHaveBeenLastCalledWith(
      tenant,
      person,
      'caller',
      'New note',
    );
    await request(app.getHttpServer())
      .patch(`${base}/${person}/notes/${note}`)
      .send({ content: 'Revised' })
      .expect(200);
    expect(service.saveNote).toHaveBeenLastCalledWith(
      tenant,
      person,
      'caller',
      'Revised',
      note,
    );
    await request(app.getHttpServer())
      .delete(`${base}/${person}/notes/${note}`)
      .expect(200);
    expect(service.removeNote).toHaveBeenCalledWith(
      tenant,
      person,
      'caller',
      note,
    );
  });
  it('rejects invalid parent IDs and server-controlled note timestamps', async () => {
    await request(app.getHttpServer()).get(`${base}/invalid/notes`).expect(400);
    await request(app.getHttpServer())
      .post(`${base}/${person}/notes`)
      .send({ content: 'Text', createdAt: '2027-01-01' })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`${base}/${person}/notes/${note}`)
      .send({ content: ' ' })
      .expect(400);
    expect(service.notes).not.toHaveBeenCalled();
    expect(service.saveNote).not.toHaveBeenCalled();
  });
  it('permits optional supervision details but does not allow changing date added', async () => {
    await request(app.getHttpServer())
      .post(base)
      .send({
        name: 'Student',
        supervisionType: 'Panel',
        startDate: '2027-01-01',
        conferences: 'Conference',
        initialDiscussionNote: 'First discussion',
      })
      .expect(201);
    expect(service.create).toHaveBeenCalledWith(
      tenant,
      'caller',
      expect.objectContaining({
        name: 'Student',
        supervisionType: 'Panel',
        initialDiscussionNote: 'First discussion',
      }),
    );
    await request(app.getHttpServer())
      .patch(`${base}/${person}`)
      .send({ createdAt: '2027-01-01' })
      .expect(400);
    expect(service.update).not.toHaveBeenCalled();
  });
  it('serves private aggregate counts for the authenticated caller only', async () => {
    const result = await request(app.getHttpServer())
      .get(`${base}/counts`)
      .expect(200);
    expect(service.counts).toHaveBeenCalledWith(tenant, 'caller');
    expect(result.body).toEqual({
      currentStudents: 31,
      potentialStudents: 7,
      visitingScholars: 2,
    });
    authenticated = false;
    await request(app.getHttpServer()).get(`${base}/counts`).expect(403);
    authenticated = true;
    member = false;
    await request(app.getHttpServer()).get(`${base}/counts`).expect(403);
    expect(service.counts).toHaveBeenCalledTimes(1);
  });
});
