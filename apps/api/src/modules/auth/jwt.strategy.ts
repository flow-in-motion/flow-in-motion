import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import * as jwksRsa from 'jwks-rsa';
import { ExtractJwt, Strategy } from 'passport-jwt';

interface SupabaseAccessTokenPayload {
  sub: string;
  aud: string | string[];
  email?: string;
  role?: string;
  user_metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface AuthenticatedPrincipal {
  sub: string;
  email?: string;
  displayName?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    const supabaseUrl = configService
      .getOrThrow<string>('SUPABASE_URL')
      .replace(/\/$/, '');
    const issuer = `${supabaseUrl}/auth/v1`;
    const audience = configService.get<string>(
      'SUPABASE_JWT_AUDIENCE',
      'authenticated',
    );

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      issuer,
      audience,
      algorithms: ['ES256', 'RS256'],
      secretOrKeyProvider: jwksRsa.passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `${issuer}/.well-known/jwks.json`,
      }),
    });
  }

  validate(payload: SupabaseAccessTokenPayload): AuthenticatedPrincipal {
    if (typeof payload.sub !== 'string' || !payload.sub.trim()) {
      throw new UnauthorizedException(
        'Supabase access token does not contain a subject claim',
      );
    }

    const metadata = payload.user_metadata ?? {};
    const displayName = [
      metadata.display_name,
      metadata.full_name,
      metadata.name,
      metadata.preferred_username,
    ].find(
      (value): value is string =>
        typeof value === 'string' && Boolean(value.trim()),
    );

    return {
      sub: payload.sub.trim(),
      email: payload.email,
      displayName: displayName?.trim(),
    };
  }
}
