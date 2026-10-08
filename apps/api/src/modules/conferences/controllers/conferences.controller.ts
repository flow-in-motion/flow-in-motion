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
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import type { AuthenticatedPrincipal } from '../../auth/jwt.strategy';
import { TenantMemberGuard } from '../../memberships/policies/tenant-member.guard';
import { UsersService } from '../../users/users.service';
import { CreateConferenceDto } from '../dto/create-conference.dto';
import { ConferenceLinkOptionsQueryDto } from '../dto/conference-link-options-query.dto';
import { UpdateConferenceDto } from '../dto/update-conference.dto';
import { ConferencesService } from '../services/conferences.service';
import { ConfigService } from '@nestjs/config';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

interface AuthenticatedRequest extends Request {
  user: AuthenticatedPrincipal;
}

@ApiTags('conferences')
@ApiBearerAuth()
@Controller('api/v1/tenant/:tenantId/conferences')
export class ConferencesController {
  constructor(
    private readonly conferencesService: ConferencesService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

  @ApiOperation({
    summary: 'List conferences visible to the authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: 'Conferences returned successfully',
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

    return this.conferencesService.list(
      tenantId,
      user.id,
      query.page ?? 1,
      pageSize,
    );
  }

  @ApiOperation({
    summary: 'Search projects and papers available to link to a conference',
  })
  @ApiResponse({
    status: 200,
    description: 'Conference link options returned successfully',
  })
  @UseGuards(JwtAuthGuard, TenantMemberGuard)
  @Get('link-options')
  async searchLinkOptions(
    @Param('tenantId') tenantId: string,
    @Req() req: AuthenticatedRequest,
    @Query() query: ConferenceLinkOptionsQueryDto,
  ) {
    const user = await this.usersService.findByExternalAuthId(req.user.sub);
    return this.conferencesService.searchLinkOptions(
      tenantId,
      user.id,
      query.search,
    );
  }

  @ApiOperation({
    summary: 'Get a single conference',
  })
  @ApiResponse({
    status: 200,
    description: 'Conference returned successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Conference not found or inaccessible',
  })
  @UseGuards(JwtAuthGuard, TenantMemberGuard)
  @Get(':conferenceId')
  async findOne(
    @Param('tenantId') tenantId: string,
    @Param('conferenceId') conferenceId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const user = await this.usersService.findByExternalAuthId(req.user.sub);

    return this.conferencesService.findOne(tenantId, conferenceId, user.id);
  }

  @ApiOperation({
    summary: 'Create a conference and link it to projects or papers',
  })
  @ApiResponse({
    status: 201,
    description: 'Conference created successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Caller does not own every selected project',
  })
  @UseGuards(JwtAuthGuard, TenantMemberGuard)
  @Post()
  async create(
    @Param('tenantId') tenantId: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateConferenceDto,
  ) {
    const user = await this.usersService.findByExternalAuthId(req.user.sub);

    return this.conferencesService.create(tenantId, user.id, dto);
  }

  @ApiOperation({
    summary: 'Update a conference',
  })
  @ApiResponse({
    status: 200,
    description: 'Conference updated successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Only the conference owner may update the conference',
  })
  @UseGuards(JwtAuthGuard, TenantMemberGuard)
  @Patch(':conferenceId')
  async update(
    @Param('tenantId') tenantId: string,
    @Param('conferenceId') conferenceId: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateConferenceDto,
  ) {
    const user = await this.usersService.findByExternalAuthId(req.user.sub);

    return this.conferencesService.update(tenantId, conferenceId, user.id, dto);
  }

  @ApiOperation({
    summary: 'Delete a conference',
  })
  @ApiResponse({
    status: 200,
    description: 'Conference deleted successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Only the conference owner may delete the conference',
  })
  @UseGuards(JwtAuthGuard, TenantMemberGuard)
  @Delete(':conferenceId')
  async remove(
    @Param('tenantId') tenantId: string,
    @Param('conferenceId') conferenceId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const user = await this.usersService.findByExternalAuthId(req.user.sub);

    return this.conferencesService.remove(tenantId, conferenceId, user.id);
  }
}
