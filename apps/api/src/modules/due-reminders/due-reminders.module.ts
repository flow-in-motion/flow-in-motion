import { Module } from '@nestjs/common';
import { MembershipsModule } from '../memberships/memberships.module';
import { PreferencesModule } from '../preferences/preferences.module';
import { UsersModule } from '../users/users.module';
import { DueRemindersController } from './due-reminders.controller';
import { DueRemindersRepository } from './due-reminders.repository';
import { DueRemindersService } from './due-reminders.service';

@Module({
  imports: [UsersModule, MembershipsModule, PreferencesModule],
  controllers: [DueRemindersController],
  providers: [DueRemindersService, DueRemindersRepository],
})
export class DueRemindersModule {}
