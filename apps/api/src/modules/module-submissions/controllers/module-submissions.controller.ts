import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
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
import { TenantMemberGuard } from '../../memberships/policies/tenant-member.guard';
import { UsersService } from '../../users/users.service';
import { CreateSubmissionDto } from '../dto/create-submission.dto';
import { UpdateSubmissionDto } from '../dto/update-submission.dto';
import { ModuleSubmissionsService } from '../services/module-submissions.service';

interface AuthenticatedRequest extends Request {
  user: AuthenticatedPrincipal;
}

@ApiTags('module-submissions')
@ApiBearerAuth()
@Controller('api/v1/tenant/:tenantId/modules/:moduleId/submissions')
export class ModuleSubmissionsController {
  constructor(
    private readonly service: ModuleSubmissionsService,
    private readonly usersService: UsersService,
  ) {}

  @ApiOperation({ summary: "List a paper's submission history" })
  @UseGuards(JwtAuthGuard, TenantMemberGuard)
  @Get()
  async list(
    @Param('tenantId') tenantId: string,
    @Param('moduleId') moduleId: string,
  ) {
    return this.service.list(tenantId, moduleId);
  }

  @ApiOperation({ summary: 'Log a submission for a paper' })
  @ApiResponse({ status: 201 })
  @UseGuards(JwtAuthGuard, TenantMemberGuard)
  @Post()
  async create(
    @Param('tenantId') tenantId: string,
    @Param('moduleId') moduleId: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateSubmissionDto,
  ) {
    const user = await this.usersService.findByExternalAuthId(req.user.sub);
    return this.service.create(tenantId, moduleId, user.id, dto);
  }

  @ApiOperation({ summary: 'Update a submission entry' })
  @UseGuards(JwtAuthGuard, TenantMemberGuard)
  @Patch(':submissionId')
  async update(
    @Param('tenantId') tenantId: string,
    @Param('moduleId') moduleId: string,
    @Param('submissionId') submissionId: string,
    @Body() dto: UpdateSubmissionDto,
  ) {
    return this.service.update(tenantId, moduleId, submissionId, dto);
  }

  @ApiOperation({ summary: 'Delete a submission entry' })
  @UseGuards(JwtAuthGuard, TenantMemberGuard)
  @Delete(':submissionId')
  async remove(
    @Param('tenantId') tenantId: string,
    @Param('moduleId') moduleId: string,
    @Param('submissionId') submissionId: string,
  ) {
    return this.service.remove(tenantId, moduleId, submissionId);
  }
}
