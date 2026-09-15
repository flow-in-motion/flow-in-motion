// apps/api/src/modules/task-invitations/controllers/task-invitations.controller.ts
import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import type { AuthenticatedPrincipal } from '../../auth/jwt.strategy';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { TenantMemberGuard } from '../../memberships/policies/tenant-member.guard';
import { UsersService } from '../../users/users.service';
import { TasksRepository } from '../../tasks/repositories/tasks.repository';
import { InviteCollaboratorDto } from '../dto/invite-collaborator.dto';
import { TaskInvitationsService } from '../services/task-invitations.service';

interface AuthenticatedRequest extends Request {
  user: AuthenticatedPrincipal;
}

@ApiTags('task-invitations')
@ApiBearerAuth()
@Controller('api/v1/tenant/:tenantId/tasks/:taskId/invitations')
export class TaskInvitationsController {
  constructor(
    private readonly service: TaskInvitationsService,
    private readonly usersService: UsersService,
    private readonly tasksRepository: TasksRepository,
  ) {}

  private async assertOwner(
    tenantId: string,
    taskId: string,
    req: AuthenticatedRequest,
  ) {
    const user = await this.usersService.findByExternalAuthId(req.user.sub);
    const task = await this.tasksRepository.findById(tenantId, taskId);
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    if (task.createdBy !== user.id) {
      throw new ForbiddenException(
        'Only the task creator can manage invitations',
      );
    }
    return user;
  }

  @ApiOperation({
    summary: 'List invitations for this task (creator only)',
  })
  @UseGuards(JwtAuthGuard, TenantMemberGuard)
  @Get()
  async list(
    @Param('tenantId') tenantId: string,
    @Param('taskId') taskId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.assertOwner(tenantId, taskId, req);
    return this.service.list(taskId);
  }

  @ApiOperation({
    summary:
      'Add a draft collaborator by name/email/affiliation (creator only) — nothing is sent yet',
  })
  @ApiResponse({ status: 201 })
  @UseGuards(JwtAuthGuard, TenantMemberGuard)
  @Post()
  async createDraft(
    @Param('tenantId') tenantId: string,
    @Param('taskId') taskId: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: InviteCollaboratorDto,
  ) {
    const user = await this.assertOwner(tenantId, taskId, req);
    return this.service.createDraft(taskId, user.id, dto);
  }

  @ApiOperation({
    summary:
      'Send the invitation email for a draft collaborator (creator only)',
  })
  @ApiResponse({ status: 201 })
  @ApiResponse({ status: 503, description: 'Email delivery unavailable' })
  @UseGuards(JwtAuthGuard, TenantMemberGuard)
  @Post(':id/send')
  async send(
    @Param('tenantId') tenantId: string,
    @Param('taskId') taskId: string,
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.assertOwner(tenantId, taskId, req);
    return this.service.send(taskId, id);
  }

  @ApiOperation({ summary: 'Revoke a pending invitation (creator only)' })
  @UseGuards(JwtAuthGuard, TenantMemberGuard)
  @Delete(':id')
  async revoke(
    @Param('tenantId') tenantId: string,
    @Param('taskId') taskId: string,
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.assertOwner(tenantId, taskId, req);
    return this.service.revoke(taskId, id);
  }
}
