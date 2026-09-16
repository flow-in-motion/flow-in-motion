import {
  Controller,
  Get,
  INestApplication,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { generateKeyPairSync, sign as cryptoSign } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthenticatedPrincipal, JwtStrategy } from './jwt.strategy';

let mockPublicKey = '';

jest.mock('jwks-rsa', () => ({
  passportJwtSecret: jest.fn(
    () =>
      (
        _request: unknown,
        _rawJwtToken: string,
        done: (error: Error | null, secret?: string) => void,
      ) =>
        done(null, mockPublicKey),
  ),
}));

interface AuthenticatedRequest {
  user: AuthenticatedPrincipal;
}

@Controller('auth-test')
class AuthTestController {
  @UseGuards(JwtAuthGuard)
  @Get()
  getProtectedResource(@Req() request: AuthenticatedRequest) {
    return {
      sub: request.user.sub,
      email: request.user.email,
      displayName: request.user.displayName,
    };
  }
}

describe('JwtAuthGuard with Supabase access tokens', () => {
  const supabaseUrl = 'https://test-project.supabase.co';
  const issuer = `${supabaseUrl}/auth/v1`;
  const audience = 'authenticated';

  let app: INestApplication<App>;
  let privateKey = '';

  function encodeSegment(value: Record<string, unknown>): string {
    return Buffer.from(JSON.stringify(value)).toString('base64url');
  }

  function createToken(
    overrides: Record<string, unknown> = {},
    signingKey = privateKey,
  ): string {
    const now = Math.floor(Date.now() / 1000);

    const header = encodeSegment({
      alg: 'RS256',
      kid: 'test-key',
      typ: 'JWT',
    });

    const payload = encodeSegment({
      sub: 'supabase-user-123',
      email: 'test@example.com',
      user_metadata: { full_name: 'Test User' },
      iss: issuer,
      aud: audience,
      role: 'authenticated',
      iat: now,
      exp: now + 300,
      ...overrides,
    });

    const signingInput = header + '.' + payload;

    const signature = cryptoSign(
      'RSA-SHA256',
      Buffer.from(signingInput),
      signingKey,
    ).toString('base64url');

    return signingInput + '.' + signature;
  }

  beforeAll(async () => {
    const keyPair = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem',
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
      },
    });

    mockPublicKey = keyPair.publicKey;
    privateKey = keyPair.privateKey;

    const configValues: Record<string, string> = {
      SUPABASE_URL: supabaseUrl,
      SUPABASE_JWT_AUDIENCE: audience,
    };

    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule],
      controllers: [AuthTestController],
      providers: [
        JwtStrategy,
        JwtAuthGuard,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(
              (key: string, fallback?: string) => configValues[key] ?? fallback,
            ),
            getOrThrow: jest.fn((key: string) => {
              const value = configValues[key];

              if (!value) {
                throw new Error('Missing test configuration: ' + key);
              }

              return value;
            }),
          },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('accepts a valid Supabase access token', async () => {
    await request(app.getHttpServer())
      .get('/auth-test')
      .set('Authorization', 'Bearer ' + createToken())
      .expect(200)
      .expect({
        sub: 'supabase-user-123',
        email: 'test@example.com',
        displayName: 'Test User',
      });
  });

  it('rejects a missing bearer token', async () => {
    await request(app.getHttpServer()).get('/auth-test').expect(401);
  });

  it('rejects a token from a different issuer', async () => {
    await request(app.getHttpServer())
      .get('/auth-test')
      .set(
        'Authorization',
        'Bearer ' +
          createToken({
            iss: 'https://wrong-project.supabase.co/auth/v1',
          }),
      )
      .expect(401);
  });

  it('rejects a token with an invalid signature', async () => {
    const wrongKeyPair = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem',
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
      },
    });

    await request(app.getHttpServer())
      .get('/auth-test')
      .set(
        'Authorization',
        'Bearer ' + createToken({}, wrongKeyPair.privateKey),
      )
      .expect(401);
  });

  it('rejects a token issued for a different audience', async () => {
    await request(app.getHttpServer())
      .get('/auth-test')
      .set('Authorization', 'Bearer ' + createToken({ aud: 'wrong-audience' }))
      .expect(401);
  });

  it('rejects a token without a subject claim', async () => {
    await request(app.getHttpServer())
      .get('/auth-test')
      .set('Authorization', 'Bearer ' + createToken({ sub: undefined }))
      .expect(401);
  });

  it('rejects an expired access token', async () => {
    const now = Math.floor(Date.now() / 1000);

    await request(app.getHttpServer())
      .get('/auth-test')
      .set(
        'Authorization',
        'Bearer ' +
          createToken({
            iat: now - 600,
            exp: now - 300,
          }),
      )
      .expect(401);
  });
});
