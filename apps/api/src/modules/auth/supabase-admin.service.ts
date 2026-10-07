import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseAdminService {
  private client: SupabaseClient | undefined;

  constructor(private readonly configService: ConfigService) {}

  private getClient(): SupabaseClient {
    if (this.client) return this.client;

    const supabaseUrl = this.configService.getOrThrow<string>('SUPABASE_URL');
    const secretKey = this.configService.get<string>('SUPABASE_SECRET_KEY');

    if (!secretKey) {
      throw new ServiceUnavailableException(
        'Account administration is not configured',
      );
    }

    this.client = createClient(supabaseUrl, secretKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    return this.client;
  }

  async assertUserExists(authUserId: string): Promise<void> {
    const { data, error } =
      await this.getClient().auth.admin.getUserById(authUserId);

    if (error || !data.user) {
      throw new UnauthorizedException(
        'Authentication account no longer exists',
      );
    }
  }

  async deleteUser(authUserId: string): Promise<void> {
    const { error } = await this.getClient().auth.admin.deleteUser(authUserId);

    if (error) {
      throw new ServiceUnavailableException(
        'The authentication account could not be deleted',
      );
    }
  }
}
