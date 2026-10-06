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
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import type { AuthenticatedPrincipal } from '../../auth/jwt.strategy';
import { TenantMemberGuard } from '../../memberships/policies/tenant-member.guard';
import { UsersService } from '../../users/users.service';
import { CreateFundingDto } from '../dto/create-funding.dto';
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
    @Query() query: PaginationQueryDto,
  ) {
    const user = await this.usersService.findByExternalAuthId(req.user.sub);
    return this.fundingsService.list(
      tenantId,
      user.id,
      query.page ?? 1,
      query.pageSize ?? this.configService.get<number>('PAGE_SIZE', 20),
      query.search?.trim() || undefined,
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
