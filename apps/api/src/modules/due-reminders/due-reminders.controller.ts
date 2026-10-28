import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import type { AuthenticatedPrincipal } from '../auth/jwt.strategy';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantMemberGuard } from '../memberships/policies/tenant-member.guard';
import { UsersService } from '../users/users.service';
import {
  DismissRemindersDto,
  DueRemindersQueryDto,
  MarkRemindersSeenDto,
  ReminderRefDto,
} from './dto/due-reminders.dto';
import { DueRemindersService } from './due-reminders.service';

interface AuthenticatedRequest extends Request {
  user: AuthenticatedPrincipal;
}

@ApiTags('due reminders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantMemberGuard)
@Controller('api/v1/tenant/:tenantId/due-reminders')
export class DueRemindersController {
  constructor(
    private readonly reminders: DueRemindersService,
    private readonly usersService: UsersService,
  ) {}

  private async userId(req: AuthenticatedRequest) {
    return (await this.usersService.findByExternalAuthId(req.user.sub)).id;
  }

  @ApiOperation({ summary: 'Items due soon or overdue, for the bell' })
  @Get()
  async list(
    @Param('tenantId') tenantId: string,
    @Req() req: AuthenticatedRequest,
    @Query() query: DueRemindersQueryDto,
  ) {
    return this.reminders.list(tenantId, await this.userId(req), query.today);
  }

  @ApiOperation({ summary: 'Mark reminders as seen' })
  @HttpCode(200)
  @Post('seen')
  async markSeen(
    @Param('tenantId') tenantId: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: MarkRemindersSeenDto,
  ) {
    return this.reminders.markSeen(tenantId, await this.userId(req), dto.items);
  }

  @ApiOperation({ summary: 'Hide a reminder until its due date changes' })
  @HttpCode(200)
  @Post('dismiss')
  async dismiss(
    @Param('tenantId') tenantId: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: ReminderRefDto,
  ) {
    return this.reminders.dismiss(tenantId, await this.userId(req), [dto]);
  }

  @ApiOperation({ summary: 'Hide several reminders at once ("Dismiss all")' })
  @HttpCode(200)
  @Post('dismiss-all')
  async dismissAll(
    @Param('tenantId') tenantId: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: DismissRemindersDto,
  ) {
    return this.reminders.dismiss(tenantId, await this.userId(req), dto.items);
  }
}
