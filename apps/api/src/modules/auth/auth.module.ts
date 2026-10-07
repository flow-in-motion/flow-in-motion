import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';
import { SupabaseAdminService } from './supabase-admin.service';

@Module({
  imports: [PassportModule],
  providers: [JwtStrategy, SupabaseAdminService],
  exports: [PassportModule, SupabaseAdminService],
})
export class AuthModule {}
