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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { AuthenticatedPrincipal } from '../auth/jwt.strategy';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from '../users/users.service';
import {
  CreateTimeEntryDto,
  UpdateTimeEntryDto,
} from '../tasks/dto/time-entry.dto';
import { WorkTimeTargetDto } from './work-time.dto';
import { WorkTimeService } from './work-time.service';
interface CallerRequest extends Request {
  user: AuthenticatedPrincipal;
}
@ApiTags('work time tracking')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/me/work-time-entries')
export class WorkTimeController {
  constructor(
    private readonly service: WorkTimeService,
    private readonly users: UsersService,
  ) {}
  private async userId(req: CallerRequest) {
    return (await this.users.findByExternalAuthId(req.user.sub)).id;
  }
  @Get('current')
  async current(@Req() req: CallerRequest) {
    return this.service.current(await this.userId(req));
  }
  @Post('timer/start')
  async start(@Req() req: CallerRequest, @Body() target: WorkTimeTargetDto) {
    return this.service.start(
      target.kind,
      target.targetId,
      await this.userId(req),
    );
  }
  @Post('timer/:id/pause')
  async pause(
    @Req() req: CallerRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.transition(id, await this.userId(req), 'pause');
  }
  @Post('timer/:id/resume')
  async resume(
    @Req() req: CallerRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.transition(id, await this.userId(req), 'resume');
  }
  @Post('timer/:id/stop')
  async stop(
    @Req() req: CallerRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.transition(id, await this.userId(req), 'stop');
  }
  @Get('items/:kind/:targetId')
  async list(@Req() req: CallerRequest, @Param() target: WorkTimeTargetDto) {
    return this.service.list(
      target.kind,
      target.targetId,
      await this.userId(req),
    );
  }
  @Post('items/:kind/:targetId')
  async add(
    @Req() req: CallerRequest,
    @Param() target: WorkTimeTargetDto,
    @Body() dto: CreateTimeEntryDto,
  ) {
    return this.service.add(
      target.kind,
      target.targetId,
      await this.userId(req),
      dto,
    );
  }
  @Patch(':id')
  async update(
    @Req() req: CallerRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTimeEntryDto,
  ) {
    return this.service.update(id, await this.userId(req), dto);
  }
  @Delete(':id')
  async remove(
    @Req() req: CallerRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.remove(id, await this.userId(req));
  }
}
