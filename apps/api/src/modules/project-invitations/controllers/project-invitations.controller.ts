// apps/api/src/modules/project-invitations/controllers/project-invitations.controller.ts
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
import { ProjectsRepository } from '../../projects/repositories/projects.repository';
import { InviteCollaboratorDto } from '../dto/invite-collaborator.dto';
import { ProjectInvitationsService } from '../services/project-invitations.service';

interface AuthenticatedRequest extends Request {
  user: AuthenticatedPrincipal;
}

@ApiTags('project-invitations')
@ApiBearerAuth()
@Controller('api/v1/tenant/:tenantId/projects/:projectId/invitations')
export class ProjectInvitationsController {
  constructor(
    private readonly service: ProjectInvitationsService,
    private readonly usersService: UsersService,
    private readonly projectsRepository: ProjectsRepository,
  ) {}

  private async assertOwner(
    tenantId: string,
    projectId: string,
    req: AuthenticatedRequest,
  ) {
    const user = await this.usersService.findByExternalAuthId(req.user.sub);
    const project = await this.projectsRepository.findById(tenantId, projectId);
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    if (project.userId !== user.id) {
      throw new ForbiddenException(
        'Only the project owner can manage invitations',
      );
    }
    return user;
  }

  @ApiOperation({
    summary: 'List pending invitations for this project (owner only)',
  })
  @UseGuards(JwtAuthGuard, TenantMemberGuard)
  @Get()
  async list(
    @Param('tenantId') tenantId: string,
    @Param('projectId') projectId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.assertOwner(tenantId, projectId, req);
    return this.service.list(projectId);
  }

  @ApiOperation({
    summary:
      'Add a draft collaborator by name/email/affiliation (owner only) — nothing is sent yet',
  })
  @ApiResponse({ status: 201 })
  @UseGuards(JwtAuthGuard, TenantMemberGuard)
  @Post()
  async createDraft(
    @Param('tenantId') tenantId: string,
    @Param('projectId') projectId: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: InviteCollaboratorDto,
  ) {
    const user = await this.assertOwner(tenantId, projectId, req);
    return this.service.createDraft(projectId, user.id, dto);
  }

  @ApiOperation({
    summary: 'Send the invitation email for a draft collaborator (owner only)',
  })
  @ApiResponse({ status: 201 })
  @ApiResponse({ status: 503, description: 'Email delivery unavailable' })
  @UseGuards(JwtAuthGuard, TenantMemberGuard)
  @Post(':id/send')
  async send(
    @Param('tenantId') tenantId: string,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.assertOwner(tenantId, projectId, req);
    return this.service.send(projectId, id);
  }

  @ApiOperation({ summary: 'Revoke a pending invitation (owner only)' })
  @UseGuards(JwtAuthGuard, TenantMemberGuard)
  @Delete(':id')
  async revoke(
    @Param('tenantId') tenantId: string,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.assertOwner(tenantId, projectId, req);
    return this.service.revoke(projectId, id);
  }
}
