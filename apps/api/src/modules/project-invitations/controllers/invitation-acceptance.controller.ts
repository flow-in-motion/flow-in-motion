// apps/api/src/modules/project-invitations/controllers/invitation-acceptance.controller.ts
import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import type { AuthenticatedPrincipal } from '../../auth/jwt.strategy';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { UsersService } from '../../users/users.service';
import { ProjectInvitationsService } from '../services/project-invitations.service';
import { ModuleInvitationsService } from '../../module-invitations/services/module-invitations.service';
import { TaskInvitationsService } from '../../task-invitations/services/task-invitations.service';
import { NoteInvitationsService } from '../../note-invitations/services/note-invitations.service';

interface AuthenticatedRequest extends Request {
  user: AuthenticatedPrincipal;
}

@ApiTags('invitations')
@Controller('api/v1/invitations')
export class InvitationAcceptanceController {
  constructor(
    private readonly projectInvitations: ProjectInvitationsService,
    private readonly moduleInvitations: ModuleInvitationsService,
    private readonly taskInvitations: TaskInvitationsService,
    private readonly noteInvitations: NoteInvitationsService,
    private readonly usersService: UsersService,
  ) {}

  @ApiOperation({
    summary: 'Preview an invitation without needing to be logged in',
  })
  @Get(':token')
  async preview(@Param('token') token: string) {
    const project = await this.projectInvitations
      .preview(token)
      .catch(() => null);

    if (project) return { type: 'project', ...project };

    const module = await this.moduleInvitations
      .preview(token)
      .catch(() => null);
    if (module) return { type: 'module', ...module };

    const task = await this.taskInvitations.preview(token).catch(() => null);
    if (task) return { type: 'task', ...task };

    const note = await this.noteInvitations.preview(token).catch(() => null);
    if (note) return { type: 'note', ...note };

    throw new NotFoundException('Invitation not found');
  }

  @ApiOperation({ summary: 'Accept an invitation' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(':token/accept')
  async accept(
    @Param('token') token: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const user = await this.usersService.findOrProvisionFromPrincipal(req.user);
    if (!user) {
      throw new NotFoundException('User could not be found or provisioned');
    }

    const project = await this.projectInvitations
      .accept(token, user.id, user.email)
      .then((row) => ({ type: 'project', row }))
      .catch(() => null);
    if (project) return project;

    const module = await this.moduleInvitations
      .accept(token, user.id, user.email)
      .then((row) => ({ type: 'module', row }))
      .catch(() => null);
    if (module) return module;

    const task = await this.taskInvitations
      .accept(token, user.id, user.email)
      .then((row) => ({ type: 'task', row }))
      .catch(() => null);
    if (task) return task;

    const note = await this.noteInvitations
      .accept(token, user.id, user.email)
      .then((row) => ({ type: 'note', row }))
      .catch(() => null);
    if (note) return note;

    throw new NotFoundException('Invitation not found');
  }
}
