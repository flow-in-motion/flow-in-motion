// apps/api/src/modules/tasks/controllers/tasks.controller.ts
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
import { CreateTaskDto } from '../dto/create-task.dto';
import { UpdateTaskDto } from '../dto/update-task.dto';
import { TasksService } from '../services/tasks.service';
import { TenantMemberGuard } from '../../memberships/policies/tenant-member.guard';
import { ConfigService } from '@nestjs/config';
import { TaskListQueryDto } from '../dto/task-list-query.dto';
import { CreateTaskDescriptionEntryDto } from '../dto/create-task-description-entry.dto';
interface AuthenticatedRequest extends Request {
  user: AuthenticatedPrincipal;
}

@ApiTags('tasks')
@ApiBearerAuth()
@Controller('api/v1/tenant/:tenantId/tasks')
export class TasksController {
  constructor(
    private readonly tasksService: TasksService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

  @ApiOperation({
    summary: 'List tasks for a workspace, optionally filtered by project',
  })
  @ApiQuery({ name: 'projectId', required: false, type: String })
  @UseGuards(JwtAuthGuard, TenantMemberGuard)
  @Get()
  async list(
    @Param('tenantId') tenantId: string,
    @Req() req: AuthenticatedRequest,
    @Query() query: TaskListQueryDto,
  ) {
    const user = await this.usersService.findByExternalAuthId(req.user.sub);
    const pageSize =
      query.pageSize ?? this.configService.get<number>('PAGE_SIZE', 20);

    return this.tasksService.list(
      tenantId,
      user.id,
      query.page ?? 1,
      pageSize,
      query.projectId,
      query.search?.trim() || undefined,
      query.projectOnly ?? false,
      query.statuses,
      query.priorities,
      query.moduleId,
    );
  }

  @ApiOperation({ summary: 'Get a single task' })
  @UseGuards(JwtAuthGuard, TenantMemberGuard)
  @Get(':taskId')
  async findOne(
    @Param('tenantId') tenantId: string,
    @Param('taskId') taskId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const user = await this.usersService.findByExternalAuthId(req.user.sub);
    return this.tasksService.findOne(tenantId, taskId, user.id);
  }

  @ApiOperation({
    summary: 'Create a task, optionally associated with a project and module',
  })
  @ApiResponse({ status: 201 })
  @UseGuards(JwtAuthGuard, TenantMemberGuard)
  @Post()
  async create(
    @Param('tenantId') tenantId: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateTaskDto,
  ) {
    const user = await this.usersService.findByExternalAuthId(req.user.sub);
    return this.tasksService.create(tenantId, user.id, dto);
  }

  @ApiOperation({ summary: 'Update a task' })
  @UseGuards(JwtAuthGuard, TenantMemberGuard)
  @Patch(':taskId')
  async update(
    @Param('tenantId') tenantId: string,
    @Param('taskId') taskId: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateTaskDto,
  ) {
    const user = await this.usersService.findByExternalAuthId(req.user.sub);
    return this.tasksService.update(tenantId, taskId, user.id, dto);
  }

  @ApiOperation({
    summary: 'Add a dated description entry to a task',
  })
  @ApiResponse({ status: 201 })
  @UseGuards(JwtAuthGuard, TenantMemberGuard)
  @Post(':taskId/description-entries')
  async appendDescriptionEntry(
    @Param('tenantId') tenantId: string,
    @Param('taskId') taskId: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateTaskDescriptionEntryDto,
  ) {
    const user = await this.usersService.findByExternalAuthId(req.user.sub);

    return this.tasksService.appendDescriptionEntry(
      tenantId,
      taskId,
      user.id,
      dto,
    );
  }

  @ApiOperation({ summary: 'Edit an existing task description entry' })
  @UseGuards(JwtAuthGuard, TenantMemberGuard)
  @Patch(':taskId/description-entries/:entryId')
  async updateDescriptionEntry(
    @Param('tenantId') tenantId: string,
    @Param('taskId') taskId: string,
    @Param('entryId') entryId: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateTaskDescriptionEntryDto,
  ) {
    const user = await this.usersService.findByExternalAuthId(req.user.sub);

    return this.tasksService.updateDescriptionEntry(
      tenantId,
      taskId,
      entryId,
      user.id,
      dto,
    );
  }

  @ApiOperation({ summary: 'Delete a task description entry' })
  @UseGuards(JwtAuthGuard, TenantMemberGuard)
  @Delete(':taskId/description-entries/:entryId')
  async deleteDescriptionEntry(
    @Param('tenantId') tenantId: string,
    @Param('taskId') taskId: string,
    @Param('entryId') entryId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const user = await this.usersService.findByExternalAuthId(req.user.sub);

    return this.tasksService.deleteDescriptionEntry(
      tenantId,
      taskId,
      entryId,
      user.id,
    );
  }

  @ApiOperation({ summary: 'Delete a task' })
  @UseGuards(JwtAuthGuard, TenantMemberGuard)
  @Delete(':taskId')
  async remove(
    @Param('tenantId') tenantId: string,
    @Param('taskId') taskId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const user = await this.usersService.findByExternalAuthId(req.user.sub);
    return this.tasksService.delete(tenantId, taskId, user.id);
  }
}
