import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AccountDeletionService } from './account-deletion.service';
import { MeController } from './me.controller';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [AuthModule],
  controllers: [MeController, UsersController],
  providers: [UsersService, AccountDeletionService],
  exports: [UsersService],
})
export class UsersModule {}
