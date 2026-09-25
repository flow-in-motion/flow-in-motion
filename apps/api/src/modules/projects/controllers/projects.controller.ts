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
} from '@nestjs/swagger';
import { Request } from 'express';
import type { AuthenticatedPrincipal } from '../../auth/jwt.strategy';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { UsersService } from '../../users/users.service';
import { CreateProjectDto } from '../dto/create-project.dto';
import { UpdateProjectDto } from '../dto/update-project.dto';
import { ProjectsService } from '../services/projects.service';
import { TenantMemberGuard } from '../../memberships/policies/tenant-member.guard';
import { ProjectAccessGuard } from '../policies/project-access.guard';
import { ConfigService } from '@nestjs/config';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
interface AuthenticatedRequest extends Request {
  user: AuthenticatedPrincipal;
}

@ApiTags('projects')
@ApiBearerAuth()
@Controller('api/v1/tenant/:tenantId/projects')
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

  @ApiOperation({
    summary: 'List active (non-archived) projects for a workspace',
  })
  @UseGuards(JwtAuthGuard, TenantMemberGuard)
  @Get()
  async list(
    @Param('tenantId') tenantId: string,
    @Req() req: AuthenticatedRequest,
    @Query() query: PaginationQueryDto,
  ) {
    const user = await this.usersService.findByExternalAuthId(req.user.sub);
    const pageSize = this.configService.get<number>('PAGE_SIZE', 20);
    return this.projectsService.listActive(
      tenantId,
      user.id,
      query.page ?? 1,
      pageSize,
    );
  }

  @ApiOperation({ summary: 'Get a single project' })
  @UseGuards(JwtAuthGuard, TenantMemberGuard, ProjectAccessGuard)
  @Get(':projectId')
  async findOne(
    @Param('tenantId') tenantId: string,
    @Param('projectId') projectId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const user = await this.usersService.findByExternalAuthId(req.user.sub);
    return this.projectsService.findOne(tenantId, projectId, user.id);
  }

  @ApiOperation({ summary: 'Create a project' })
  @ApiResponse({ status: 201 })
  @UseGuards(JwtAuthGuard, TenantMemberGuard)
  @Post()
  async create(
    @Param('tenantId') tenantId: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateProjectDto,
  ) {
    const user = await this.usersService.findByExternalAuthId(req.user.sub);
    return this.projectsService.create(user.id, tenantId, dto);
  }

  @ApiOperation({ summary: 'Update a project' })
  @UseGuards(JwtAuthGuard, TenantMemberGuard, ProjectAccessGuard)
  @Patch(':projectId')
  async update(
    @Param('tenantId') tenantId: string,
    @Param('projectId') projectId: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateProjectDto,
  ) {
    const user = await this.usersService.findByExternalAuthId(req.user.sub);
    return this.projectsService.update(tenantId, projectId, user.id, dto);
  }

  @ApiOperation({ summary: 'Archive a project (auto-deleted after 14 days)' })
  @UseGuards(JwtAuthGuard, TenantMemberGuard, ProjectAccessGuard)
  @Delete(':projectId')
  async archive(
    @Param('tenantId') tenantId: string,
    @Param('projectId') projectId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const user = await this.usersService.findByExternalAuthId(req.user.sub);
    return this.projectsService.archive(tenantId, projectId, user.id);
  }
}
