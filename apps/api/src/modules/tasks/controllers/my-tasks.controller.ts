// apps/api/src/modules/tasks/controllers/my-tasks.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Req,
  UseGuards,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import type { AuthenticatedPrincipal } from '../../auth/jwt.strategy';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { UsersService } from '../../users/users.service';
import { UpdateTaskDto } from '../dto/update-task.dto';
import { TasksService } from '../services/tasks.service';
import { CreateTaskDescriptionEntryDto } from '../dto/create-task-description-entry.dto';

interface AuthenticatedRequest extends Request {
  user: AuthenticatedPrincipal;
}

/**
 * Tenant-agnostic view of tasks the caller can access — a task the caller
 * created or was explicitly added to as a member, regardless of which
 * workspace it belongs to. Deliberately guarded by JwtAuthGuard only, not
 * TenantMemberGuard: task visibility never depended on tenant membership
 * (a project collaborator doesn't automatically see a task either), so a
 * task shared with someone outside the owning tenant must still be reachable.
 */
@ApiTags('tasks')
@ApiBearerAuth()
@Controller('api/v1/me/tasks')
export class MyTasksController {
  constructor(
    private readonly tasksService: TasksService,
    private readonly usersService: UsersService,
  ) {}

  @ApiOperation({
    summary: 'List every task the caller can access, across all workspaces',
  })
  @UseGuards(JwtAuthGuard)
  @Get()
  async list(@Req() req: AuthenticatedRequest) {
    const user = await this.usersService.findByExternalAuthId(req.user.sub);
    return this.tasksService.listForCaller(user.id);
  }

  @ApiOperation({ summary: 'Get a single task the caller can access' })
  @UseGuards(JwtAuthGuard)
  @Get(':taskId')
  async findOne(
    @Param('taskId') taskId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const user = await this.usersService.findByExternalAuthId(req.user.sub);
    return this.tasksService.findOneForCaller(taskId, user.id);
  }

  @ApiOperation({ summary: 'Update a task the caller can access' })
  @UseGuards(JwtAuthGuard)
  @Patch(':taskId')
  async update(
    @Param('taskId') taskId: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateTaskDto,
  ) {
    const user = await this.usersService.findByExternalAuthId(req.user.sub);
    return this.tasksService.updateForCaller(taskId, user.id, dto);
  }

  @ApiOperation({
    summary: 'Add a dated description entry to a task the caller can access',
  })
  @UseGuards(JwtAuthGuard)
  @Post(':taskId/description-entries')
  async appendDescriptionEntry(
    @Param('taskId') taskId: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateTaskDescriptionEntryDto,
  ) {
    const user = await this.usersService.findByExternalAuthId(req.user.sub);

    return this.tasksService.appendDescriptionEntryForCaller(
      taskId,
      user.id,
      dto,
    );
  }

  @ApiOperation({ summary: 'Delete a task the caller can access' })
  @UseGuards(JwtAuthGuard)
  @Delete(':taskId')
  async remove(
    @Param('taskId') taskId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const user = await this.usersService.findByExternalAuthId(req.user.sub);
    return this.tasksService.deleteForCaller(taskId, user.id);
  }
}
