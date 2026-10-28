import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import type { AuthenticatedPrincipal } from '../../auth/jwt.strategy';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { UsersService } from '../../users/users.service';
import {
  CreateTimeEntryDto,
  StartTimerDto,
  UpdateTimeEntryDto,
} from '../dto/time-entry.dto';
import { TaskTimeEntriesService } from '../services/task-time-entries.service';

interface AuthenticatedRequest extends Request {
  user: AuthenticatedPrincipal;
}

/**
 * The caller's own time on tasks, across every workspace (like
 * MyTasksController, since a shared task may live in another workspace).
 * Timer responses are wrapped ({ timer }) so "no timer" is a real JSON null.
 */
@ApiTags('time tracking')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/me')
export class TimeEntriesController {
  constructor(
    private readonly timeEntries: TaskTimeEntriesService,
    private readonly usersService: UsersService,
  ) {}

  private async userId(req: AuthenticatedRequest) {
    const user = await this.usersService.findByExternalAuthId(req.user.sub);
    return user.id;
  }

  @ApiOperation({ summary: "The caller's running or paused timer, if any" })
  @Get('time-entries/current')
  async current(@Req() req: AuthenticatedRequest) {
    return { timer: await this.timeEntries.current(await this.userId(req)) };
  }

  @ApiOperation({
    summary: 'Start timing a task (stops any other timer first)',
  })
  @Post('time-entries/timer/start')
  async start(@Req() req: AuthenticatedRequest, @Body() dto: StartTimerDto) {
    return {
      timer: await this.timeEntries.start(await this.userId(req), dto.taskId),
    };
  }

  @ApiOperation({ summary: 'Pause the running timer' })
  @Post('time-entries/timer/pause')
  async pause(@Req() req: AuthenticatedRequest) {
    return { timer: await this.timeEntries.pause(await this.userId(req)) };
  }

  @ApiOperation({ summary: 'Resume the paused timer' })
  @Post('time-entries/timer/resume')
  async resume(@Req() req: AuthenticatedRequest) {
    return { timer: await this.timeEntries.resume(await this.userId(req)) };
  }

  @ApiOperation({ summary: 'Stop the timer and keep the time logged' })
  @Post('time-entries/timer/stop')
  async stop(@Req() req: AuthenticatedRequest) {
    return { stopped: await this.timeEntries.stop(await this.userId(req)) };
  }

  @ApiOperation({
    summary: "The caller's time entries on a task, with the task's totals",
  })
  @Get('tasks/:taskId/time-entries')
  async listForTask(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.timeEntries.listForTask(taskId, await this.userId(req));
  }

  @ApiOperation({ summary: 'Add time to a task by hand' })
  @Post('tasks/:taskId/time-entries')
  async addManual(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateTimeEntryDto,
  ) {
    return this.timeEntries.addManual(taskId, await this.userId(req), dto);
  }

  @ApiOperation({ summary: 'Correct one of your finished time entries' })
  @Patch('time-entries/:entryId')
  async update(
    @Param('entryId', ParseUUIDPipe) entryId: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateTimeEntryDto,
  ) {
    return this.timeEntries.update(entryId, await this.userId(req), dto);
  }

  @ApiOperation({ summary: 'Delete one of your finished time entries' })
  @Delete('time-entries/:entryId')
  async remove(
    @Param('entryId', ParseUUIDPipe) entryId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.timeEntries.remove(entryId, await this.userId(req));
  }
}
