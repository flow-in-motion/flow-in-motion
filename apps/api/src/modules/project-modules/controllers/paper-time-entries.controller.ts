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
  StartPaperTimerDto,
  UpdateTimeEntryDto,
} from '../dto/paper-time-entry.dto';
import { PaperTimeEntriesService } from '../services/paper-time-entries.service';

interface AuthenticatedRequest extends Request {
  user: AuthenticatedPrincipal;
}

/**
 * The caller's own time on papers, across every workspace (like
 * MyModulesController, since a shared paper may live in another workspace).
 * Timer responses are wrapped ({ timer }) so "no timer" is a real JSON null.
 */
@ApiTags('time tracking')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/me')
export class PaperTimeEntriesController {
  constructor(
    private readonly timeEntries: PaperTimeEntriesService,
    private readonly usersService: UsersService,
  ) {}

  private async userId(req: AuthenticatedRequest) {
    const user = await this.usersService.findByExternalAuthId(req.user.sub);
    return user.id;
  }

  @ApiOperation({ summary: "The caller's running or paused timer, if any" })
  @Get('paper-time-entries/current')
  async current(@Req() req: AuthenticatedRequest) {
    return { timer: await this.timeEntries.current(await this.userId(req)) };
  }

  @ApiOperation({
    summary: 'Start timing a paper (stops any other paper timer first)',
  })
  @Post('paper-time-entries/timer/start')
  async start(
    @Req() req: AuthenticatedRequest,
    @Body() dto: StartPaperTimerDto,
  ) {
    return {
      timer: await this.timeEntries.start(await this.userId(req), dto.paperId),
    };
  }

  @ApiOperation({ summary: 'Pause the running timer' })
  @Post('paper-time-entries/timer/pause')
  async pause(@Req() req: AuthenticatedRequest) {
    return { timer: await this.timeEntries.pause(await this.userId(req)) };
  }

  @ApiOperation({ summary: 'Resume the paused timer' })
  @Post('paper-time-entries/timer/resume')
  async resume(@Req() req: AuthenticatedRequest) {
    return { timer: await this.timeEntries.resume(await this.userId(req)) };
  }

  @ApiOperation({ summary: 'Stop the timer and keep the time logged' })
  @Post('paper-time-entries/timer/stop')
  async stop(@Req() req: AuthenticatedRequest) {
    return { stopped: await this.timeEntries.stop(await this.userId(req)) };
  }

  @ApiOperation({
    summary: "The caller's time entries on a paper, with the paper's totals",
  })
  @Get('modules/:paperId/time-entries')
  async listForPaper(
    @Param('paperId', ParseUUIDPipe) paperId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.timeEntries.listForPaper(paperId, await this.userId(req));
  }

  @ApiOperation({ summary: 'Add time to a paper by hand' })
  @Post('modules/:paperId/time-entries')
  async addManual(
    @Param('paperId', ParseUUIDPipe) paperId: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateTimeEntryDto,
  ) {
    return this.timeEntries.addManual(paperId, await this.userId(req), dto);
  }

  @ApiOperation({ summary: 'Correct one of your finished time entries' })
  @Patch('paper-time-entries/:entryId')
  async update(
    @Param('entryId', ParseUUIDPipe) entryId: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateTimeEntryDto,
  ) {
    return this.timeEntries.update(entryId, await this.userId(req), dto);
  }

  @ApiOperation({ summary: 'Delete one of your finished time entries' })
  @Delete('paper-time-entries/:entryId')
  async remove(
    @Param('entryId', ParseUUIDPipe) entryId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.timeEntries.remove(entryId, await this.userId(req));
  }
}
