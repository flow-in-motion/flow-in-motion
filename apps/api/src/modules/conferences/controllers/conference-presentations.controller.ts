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
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import type { AuthenticatedPrincipal } from '../../auth/jwt.strategy';
import { TenantMemberGuard } from '../../memberships/policies/tenant-member.guard';
import { UsersService } from '../../users/users.service';
import { SaveConferencePresentationDto } from '../dto/save-conference-presentation.dto';
import { ConferencesService } from '../services/conferences.service';

interface AuthenticatedRequest extends Request {
  user: AuthenticatedPrincipal;
}

@ApiTags('conference-presentations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantMemberGuard)
@Controller(
  'api/v1/tenant/:tenantId/modules/:moduleId/conference-presentations',
)
export class ConferencePresentationsController {
  constructor(
    private readonly conferencesService: ConferencesService,
    private readonly usersService: UsersService,
  ) {}

  @Get()
  @ApiOperation({ summary: "List a paper's conference presentation history" })
  async list(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Param('moduleId', ParseUUIDPipe) moduleId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.conferencesService.listPaperPresentations(
      tenantId,
      moduleId,
      await this.callerId(req),
    );
  }

  @Get('conference-options')
  @ApiOperation({
    summary: 'List owned conferences available for a presentation',
  })
  async options(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Param('moduleId', ParseUUIDPipe) moduleId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.conferencesService.presentationConferenceOptions(
      tenantId,
      moduleId,
      await this.callerId(req),
    );
  }

  @Post(':conferenceId')
  @ApiOperation({ summary: 'Record a conference presentation for a paper' })
  async create(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Param('moduleId', ParseUUIDPipe) moduleId: string,
    @Param('conferenceId', ParseUUIDPipe) conferenceId: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: SaveConferencePresentationDto,
  ) {
    return this.conferencesService.savePaperPresentation(
      tenantId,
      moduleId,
      conferenceId,
      await this.callerId(req),
      dto,
      'create',
    );
  }

  @Patch(':conferenceId')
  @ApiOperation({ summary: 'Replace the details of a recorded presentation' })
  async update(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Param('moduleId', ParseUUIDPipe) moduleId: string,
    @Param('conferenceId', ParseUUIDPipe) conferenceId: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: SaveConferencePresentationDto,
  ) {
    return this.conferencesService.savePaperPresentation(
      tenantId,
      moduleId,
      conferenceId,
      await this.callerId(req),
      dto,
      'update',
    );
  }

  @Delete(':conferenceId')
  @ApiOperation({
    summary: 'Clear presentation details while keeping the conference link',
  })
  async remove(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Param('moduleId', ParseUUIDPipe) moduleId: string,
    @Param('conferenceId', ParseUUIDPipe) conferenceId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.conferencesService.removePaperPresentation(
      tenantId,
      moduleId,
      conferenceId,
      await this.callerId(req),
    );
  }

  private async callerId(req: AuthenticatedRequest): Promise<string> {
    const user = await this.usersService.findByExternalAuthId(req.user.sub);

    if (!user) throw new UnauthorizedException();

    return user.id;
  }
}
