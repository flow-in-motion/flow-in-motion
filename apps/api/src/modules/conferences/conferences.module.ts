import { Module } from '@nestjs/common';
import { MembershipsModule } from '../memberships/memberships.module';
import { UsersModule } from '../users/users.module';
import { ConferencesController } from './controllers/conferences.controller';
import { ConferencesRepository } from './repositories/conferences.repository';
import { ConferencesService } from './services/conferences.service';
import { ConferencePresentationsController } from './controllers/conference-presentations.controller';

@Module({
  imports: [UsersModule, MembershipsModule],
  controllers: [ConferencesController, ConferencePresentationsController],
  providers: [ConferencesService, ConferencesRepository],
  exports: [ConferencesService, ConferencesRepository],
})
export class ConferencesModule {}
