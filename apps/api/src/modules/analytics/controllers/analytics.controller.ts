import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import type { AuthenticatedPrincipal } from '../../auth/jwt.strategy';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { TenantMemberGuard } from '../../memberships/policies/tenant-member.guard';
import { TenantOwnerGuard } from '../../memberships/policies/tenant-owner.guard';
import { UsersService } from '../../users/users.service';
import { AnalyticsSummaryQueryDto } from '../dto/analytics-summary-query.dto';
import { CreateAnalyticsEventDto } from '../dto/create-analytics-event.dto';
import { AnalyticsService } from '../services/analytics.service';

interface AuthenticatedRequest extends Request {
  user: AuthenticatedPrincipal;
}

@ApiTags('analytics')
@ApiBearerAuth()
@Controller('api/v1/tenant/:tenantId/analytics')
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly usersService: UsersService,
  ) {}

  @ApiOperation({ summary: 'Record a product-analytics event' })
  @UseGuards(JwtAuthGuard, TenantMemberGuard)
  @Post('events')
  async recordEvent(
    @Param('tenantId') tenantId: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateAnalyticsEventDto,
  ) {
    const user = await this.usersService.findByExternalAuthId(req.user.sub);
    return this.analyticsService.recordEvent(tenantId, user.id, dto);
  }

  @ApiOperation({
    summary: 'Research progress and usage insights (owner only)',
  })
  @UseGuards(JwtAuthGuard, TenantMemberGuard, TenantOwnerGuard)
  @Get('summary')
  async summary(
    @Param('tenantId') tenantId: string,
    @Query() query: AnalyticsSummaryQueryDto,
  ) {
    return this.analyticsService.summary(tenantId, query.days);
  }
}
