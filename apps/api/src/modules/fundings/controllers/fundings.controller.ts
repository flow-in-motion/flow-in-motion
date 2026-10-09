import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
import { CreateFundingDto } from '../dto/create-funding.dto';
import { ListFundingsQueryDto } from '../dto/list-fundings-query.dto';
import { UpdateFundingDto } from '../dto/update-funding.dto';
import { FundingsService } from '../services/fundings.service';

interface AuthenticatedRequest extends Request {
  user: AuthenticatedPrincipal;
}

@ApiTags('funding')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantMemberGuard)
@Controller('api/v1/tenant/:tenantId/fundings')
export class FundingsController {
  constructor(
    private readonly fundingsService: FundingsService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

  @ApiOperation({ summary: 'List visible funding records' })
  @Get()
  async list(
    @Param('tenantId') tenantId: string,
    @Req() req: AuthenticatedRequest,
    @Query() query: ListFundingsQueryDto,
  ) {
    const user = await this.usersService.findByExternalAuthId(req.user.sub);
    return this.fundingsService.list(
      tenantId,
      user.id,
      query.page ?? 1,
      query.pageSize ?? this.configService.get<number>('PAGE_SIZE', 20),
      query.search?.trim() || undefined,
      query.sortBy,
      query.sortDirection,
    );
  }

  @ApiOperation({ summary: 'Get one funding record' })
  @Get(':fundingId')
  async findOne(
    @Param('tenantId') tenantId: string,
    @Param('fundingId') fundingId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const user = await this.usersService.findByExternalAuthId(req.user.sub);
    return this.fundingsService.findOne(tenantId, fundingId, user.id);
  }

  @ApiOperation({ summary: 'Create a funding record' })
  @ApiResponse({ status: 201 })
  @Post()
  async create(
    @Param('tenantId') tenantId: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateFundingDto,
  ) {
    const user = await this.usersService.findByExternalAuthId(req.user.sub);
    return this.fundingsService.create(tenantId, user.id, dto);
  }

  @ApiOperation({ summary: 'Update a funding record' })
  @Patch(':fundingId')
  async update(
    @Param('tenantId') tenantId: string,
    @Param('fundingId') fundingId: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateFundingDto,
  ) {
    const user = await this.usersService.findByExternalAuthId(req.user.sub);
    return this.fundingsService.update(tenantId, fundingId, user.id, dto);
  }

  @ApiOperation({ summary: 'Attach a note to a funding record' })
  @Post(':fundingId/notes/:noteId')
  async attachNote(
    @Param('tenantId') tenantId: string,
    @Param('fundingId') fundingId: string,
    @Param('noteId') noteId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const user = await this.usersService.findByExternalAuthId(req.user.sub);
    return this.fundingsService.attachNote(
      tenantId,
      fundingId,
      noteId,
      user.id,
    );
  }

  @ApiOperation({ summary: 'Detach a note from a funding record' })
  @Delete(':fundingId/notes/:noteId')
  async detachNote(
    @Param('tenantId') tenantId: string,
    @Param('fundingId') fundingId: string,
    @Param('noteId') noteId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const user = await this.usersService.findByExternalAuthId(req.user.sub);
    return this.fundingsService.detachNote(
      tenantId,
      fundingId,
      noteId,
      user.id,
    );
  }

  @ApiOperation({ summary: 'Attach a task to a funding record' })
  @Post(':fundingId/tasks/:taskId')
  async attachTask(
    @Param('tenantId') tenantId: string,
    @Param('fundingId') fundingId: string,
    @Param('taskId') taskId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const user = await this.usersService.findByExternalAuthId(req.user.sub);
    return this.fundingsService.attachTask(
      tenantId,
      fundingId,
      taskId,
      user.id,
    );
  }

  @ApiOperation({ summary: 'Detach a task from a funding record' })
  @Delete(':fundingId/tasks/:taskId')
  async detachTask(
    @Param('tenantId') tenantId: string,
    @Param('fundingId') fundingId: string,
    @Param('taskId') taskId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const user = await this.usersService.findByExternalAuthId(req.user.sub);
    return this.fundingsService.detachTask(
      tenantId,
      fundingId,
      taskId,
      user.id,
    );
  }

  @ApiOperation({ summary: 'Delete a funding record' })
  @Delete(':fundingId')
  async remove(
    @Param('tenantId') tenantId: string,
    @Param('fundingId') fundingId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const user = await this.usersService.findByExternalAuthId(req.user.sub);
    return this.fundingsService.remove(tenantId, fundingId, user.id);
  }
}
