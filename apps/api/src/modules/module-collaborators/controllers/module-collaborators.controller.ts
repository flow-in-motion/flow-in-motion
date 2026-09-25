// apps/api/src/modules/module-collaborators/controllers/module-collaborators.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
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
import { UsersService } from '../../users/users.service';
import { AddCollaboratorDto } from '../dto/add-collaborator.dto';
import { UpdateRoleDto } from '../dto/update-role.dto';
import { ModuleCollaboratorsService } from '../services/module-collaborators.service';
import { TenantMemberGuard } from '../../memberships/policies/tenant-member.guard';

interface AuthenticatedRequest extends Request {
  user: AuthenticatedPrincipal;
}

@ApiTags('module-collaborators')
@ApiBearerAuth()
@Controller('api/v1/tenant/:tenantId/modules/:moduleId/collaborators')
export class ModuleCollaboratorsController {
  constructor(
    private readonly service: ModuleCollaboratorsService,
    private readonly usersService: UsersService,
  ) {}

  @ApiOperation({ summary: 'List collaborators on a module' })
  @UseGuards(JwtAuthGuard, TenantMemberGuard)
  @Get()
  async list(
    @Param('tenantId') tenantId: string,
    @Param('moduleId') moduleId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const user = await this.usersService.findByExternalAuthId(req.user.sub);
    return this.service.list(tenantId, moduleId, user.id);
  }

  @ApiOperation({ summary: 'Add a collaborator to a module' })
  @ApiResponse({ status: 201 })
  @UseGuards(JwtAuthGuard, TenantMemberGuard)
  @Post()
  async add(
    @Param('tenantId') tenantId: string,
    @Param('moduleId') moduleId: string,
    @Body() dto: AddCollaboratorDto,
  ) {
    return this.service.add(tenantId, moduleId, dto.userId, dto.role);
  }

  @ApiOperation({ summary: "Update a collaborator's role" })
  @UseGuards(JwtAuthGuard, TenantMemberGuard)
  @Patch(':userId')
  async updateRole(
    @Param('tenantId') tenantId: string,
    @Param('moduleId') moduleId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.service.updateRole(tenantId, moduleId, userId, dto.role);
  }

  @ApiOperation({ summary: 'Remove a collaborator from a module' })
  @UseGuards(JwtAuthGuard, TenantMemberGuard)
  @Delete(':userId')
  async remove(
    @Param('tenantId') tenantId: string,
    @Param('moduleId') moduleId: string,
    @Param('userId') userId: string,
  ) {
    return this.service.remove(tenantId, moduleId, userId);
  }
}
