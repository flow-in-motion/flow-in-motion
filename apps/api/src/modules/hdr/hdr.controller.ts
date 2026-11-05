import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedPrincipal } from '../auth/jwt.strategy';
import { TenantMemberGuard } from '../memberships/policies/tenant-member.guard';
import { UsersService } from '../users/users.service';
import {
  CreateHdrPersonDto,
  ListHdrPeopleDto,
  UpdateHdrPersonDto,
} from './dto/hdr-person.dto';
import { HdrService } from './hdr.service';

interface AuthenticatedRequest extends Request {
  user: AuthenticatedPrincipal;
}

@ApiTags('HDR')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantMemberGuard)
@Controller('api/v1/tenant/:tenantId/hdr-people')
export class HdrController {
  constructor(
    private readonly service: HdrService,
    private readonly users: UsersService,
  ) {}

  private async caller(req: AuthenticatedRequest) {
    return (await this.users.findByExternalAuthId(req.user.sub)).id;
  }

  @Get()
  @ApiOperation({ summary: 'List the caller’s private HDR records and counts' })
  async list(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Req() req: AuthenticatedRequest,
    @Query() query: ListHdrPeopleDto,
  ) {
    return this.service.list(tenantId, await this.caller(req), query);
  }

  @Post()
  @ApiOperation({ summary: 'Add an HDR student or visiting scholar' })
  async create(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateHdrPersonDto,
  ) {
    return this.service.create(tenantId, await this.caller(req), dto);
  }

  @Patch(':personId')
  @ApiOperation({ summary: 'Edit an owned HDR record and its work links' })
  async update(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Param('personId', ParseUUIDPipe) personId: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateHdrPersonDto,
  ) {
    return this.service.update(tenantId, personId, await this.caller(req), dto);
  }

  @Delete(':personId')
  @ApiOperation({
    summary: 'Delete an owned HDR record without deleting linked work',
  })
  async remove(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Param('personId', ParseUUIDPipe) personId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.remove(tenantId, personId, await this.caller(req));
  }
}
