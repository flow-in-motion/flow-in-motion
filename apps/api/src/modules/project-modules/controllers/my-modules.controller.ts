// apps/api/src/modules/project-modules/controllers/my-modules.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Req,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import type { AuthenticatedPrincipal } from '../../auth/jwt.strategy';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { UsersService } from '../../users/users.service';
import { UpdateModuleDto } from '../dto/update-module.dto';
import { ProjectModulesService } from '../services/project-modules.service';
import { ConfigService } from '@nestjs/config';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

interface AuthenticatedRequest extends Request {
  user: AuthenticatedPrincipal;
}

/**
 * Tenant-agnostic view of modules the caller can access — a module linked
 * to a project the caller can access, or an independent module the caller
 * was explicitly added to as a collaborator, regardless of which workspace
 * it belongs to. Guarded by JwtAuthGuard only, not TenantMemberGuard,
 * mirroring MyProjectsController / MyTasksController.
 */
@ApiTags('modules')
@ApiBearerAuth()
@Controller('api/v1/me/modules')
export class MyModulesController {
  constructor(
    private readonly modulesService: ProjectModulesService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

  @ApiOperation({
    summary: 'List every module the caller can access, across all workspaces',
  })
  @UseGuards(JwtAuthGuard)
  @Get()
  async list(
    @Req() req: AuthenticatedRequest,
    @Query() query: PaginationQueryDto,
  ) {
    const user = await this.usersService.findByExternalAuthId(req.user.sub);

    const pageSize = this.configService.get<number>('PAGE_SIZE', 20);

    return this.modulesService.listForCaller(
      user.id,
      query.page ?? 1,
      pageSize,
    );
  }

  @ApiOperation({ summary: 'Get a single module the caller can access' })
  @UseGuards(JwtAuthGuard)
  @Get(':moduleId')
  async findOne(
    @Param('moduleId') moduleId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const user = await this.usersService.findByExternalAuthId(req.user.sub);
    return this.modulesService.findOneForCaller(moduleId, user.id);
  }

  @ApiOperation({ summary: 'Update a module the caller can access' })
  @UseGuards(JwtAuthGuard)
  @Patch(':moduleId')
  async update(
    @Param('moduleId') moduleId: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateModuleDto,
  ) {
    const user = await this.usersService.findByExternalAuthId(req.user.sub);
    return this.modulesService.updateForCaller(moduleId, user.id, dto);
  }

  @ApiOperation({ summary: 'Archive a module the caller can access' })
  @UseGuards(JwtAuthGuard)
  @Delete(':moduleId')
  async archive(
    @Param('moduleId') moduleId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const user = await this.usersService.findByExternalAuthId(req.user.sub);
    return this.modulesService.archiveForCaller(moduleId, user.id);
  }
}
