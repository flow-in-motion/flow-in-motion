// apps/api/src/modules/project-modules/controllers/project-modules.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiQuery,
} from '@nestjs/swagger';
import { Request } from 'express';
import type { AuthenticatedPrincipal } from '../../auth/jwt.strategy';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { UsersService } from '../../users/users.service';
import { CreateModuleDto } from '../dto/create-module.dto';
import { UpdateModuleDto } from '../dto/update-module.dto';
import { ProjectModulesService } from '../services/project-modules.service';
import { TenantMemberGuard } from '../../memberships/policies/tenant-member.guard';
import { ModuleAccessGuard } from '../policies/module-access.guard';
import { ConfigService } from '@nestjs/config';
import { ProjectScopedPaginationQueryDto } from '../../../common/dto/pagination-query.dto';
interface AuthenticatedRequest extends Request {
  user: AuthenticatedPrincipal;
}

@ApiTags('modules')
@ApiBearerAuth()
@Controller('api/v1/tenant/:tenantId/modules')
export class ProjectModulesController {
  constructor(
    private readonly modulesService: ProjectModulesService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

  @ApiOperation({
    summary:
      'List active papers for a workspace, optionally filtered by project',
  })
  @ApiQuery({ name: 'projectId', required: false })
  @UseGuards(JwtAuthGuard, TenantMemberGuard)
  @Get()
  async list(
    @Param('tenantId') tenantId: string,
    @Req() req: AuthenticatedRequest,
    @Query() query: ProjectScopedPaginationQueryDto,
  ) {
    const user = await this.usersService.findByExternalAuthId(req.user.sub);

    const pageSize = query.pageSize ?? this.configService.get<number>('PAGE_SIZE', 20);

    return this.modulesService.listActive(
      tenantId,
      user.id,
      query.page ?? 1,
      pageSize,
      query.projectId,
      query.search?.trim() || undefined,
    );
  }

  @ApiOperation({ summary: 'Get a single paper' })
  @UseGuards(JwtAuthGuard, TenantMemberGuard, ModuleAccessGuard)
  @Get(':moduleId')
  async findOne(
    @Param('tenantId') tenantId: string,
    @Param('moduleId') moduleId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const user = await this.usersService.findByExternalAuthId(req.user.sub);
    return this.modulesService.findOne(tenantId, moduleId, user.id);
  }

  @ApiOperation({
    summary: 'Create a paper associated with a project',
  })
  @ApiResponse({ status: 201 })
  @UseGuards(JwtAuthGuard, TenantMemberGuard)
  @Post()
  async create(
    @Param('tenantId') tenantId: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateModuleDto,
  ) {
    const user = await this.usersService.findByExternalAuthId(req.user.sub);
    return this.modulesService.create(tenantId, user.id, dto);
  }

  @ApiOperation({ summary: 'Update a paper' })
  @UseGuards(JwtAuthGuard, TenantMemberGuard, ModuleAccessGuard)
  @Patch(':moduleId')
  async update(
    @Param('tenantId') tenantId: string,
    @Param('moduleId') moduleId: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateModuleDto,
  ) {
    const user = await this.usersService.findByExternalAuthId(req.user.sub);
    return this.modulesService.update(tenantId, moduleId, user.id, dto);
  }

  @ApiOperation({ summary: 'Archive a paper (auto-deleted after 14 days)' })
  @UseGuards(JwtAuthGuard, TenantMemberGuard, ModuleAccessGuard)
  @Delete(':moduleId')
  async archive(
    @Param('tenantId') tenantId: string,
    @Param('moduleId') moduleId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const user = await this.usersService.findByExternalAuthId(req.user.sub);
    return this.modulesService.archive(tenantId, moduleId, user.id);
  }
}
