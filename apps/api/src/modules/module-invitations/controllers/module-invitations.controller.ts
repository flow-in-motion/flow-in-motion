// apps/api/src/modules/module-invitations/controllers/module-invitations.controller.ts
import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
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
import { ModuleCollaboratorsService } from '../../module-collaborators/services/module-collaborators.service';
import { EnumRepository } from '../../enum/repositories/enum.repository';
import { InviteCollaboratorDto } from '../dto/invite-collaborator.dto';
import { ModuleInvitationsService } from '../services/module-invitations.service';

interface AuthenticatedRequest extends Request {
  user: AuthenticatedPrincipal;
}

@ApiTags('module-invitations')
@ApiBearerAuth()
@Controller('api/v1/tenant/:tenantId/modules/:moduleId/invitations')
export class ModuleInvitationsController {
  constructor(
    private readonly service: ModuleInvitationsService,
    private readonly usersService: UsersService,
    private readonly moduleCollaboratorsService: ModuleCollaboratorsService,
    private readonly enumRepository: EnumRepository,
  ) {}

  private async assertOwner(
    tenantId: string,
    moduleId: string,
    req: AuthenticatedRequest,
  ) {
    const user = await this.usersService.findByExternalAuthId(req.user.sub);
    const membership =
      await this.moduleCollaboratorsService.ensureOwnerMembership(
        tenantId,
        moduleId,
        user.id,
      );
    if (!membership) {
      throw new ForbiddenException(
        'Only the module owner can manage invitations',
      );
    }
    const ownerRole = await this.enumRepository.findByCategoryAndValue(
      'project_role',
      'Owner',
    );
    if (!ownerRole || membership.roleId !== ownerRole.id) {
      throw new ForbiddenException(
        'Only the module owner can manage invitations',
      );
    }
    return user;
  }

  @ApiOperation({
    summary: 'List pending invitations for this module (owner only)',
  })
  @UseGuards(JwtAuthGuard, TenantMemberGuard)
  @Get()
  async list(
    @Param('tenantId') tenantId: string,
    @Param('moduleId') moduleId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.assertOwner(tenantId, moduleId, req);
    return this.service.list(moduleId);
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
    @Param('moduleId') moduleId: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: InviteCollaboratorDto,
  ) {
    const user = await this.assertOwner(tenantId, moduleId, req);
    return this.service.createDraft(moduleId, user.id, dto);
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
    @Param('moduleId') moduleId: string,
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.assertOwner(tenantId, moduleId, req);
    return this.service.send(moduleId, id);
  }

  @ApiOperation({ summary: 'Revoke a pending invitation (owner only)' })
  @UseGuards(JwtAuthGuard, TenantMemberGuard)
  @Delete(':id')
  async revoke(
    @Param('tenantId') tenantId: string,
    @Param('moduleId') moduleId: string,
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.assertOwner(tenantId, moduleId, req);
    return this.service.revoke(moduleId, id);
  }
}
