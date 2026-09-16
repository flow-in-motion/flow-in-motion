import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
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
import type { AuthenticatedPrincipal } from '../../auth/jwt.strategy';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { UsersService } from '../../users/users.service';
import { CreateWorkspaceDto } from '../dto/create-workspace.dto';
import { SwitchWorkspaceDto } from '../dto/switch-workspace.dto';
import { WorkspacesService } from '../services/workspaces.service';
import { ConfigService } from '@nestjs/config';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
interface AuthenticatedRequest extends Request {
  user: AuthenticatedPrincipal;
}

@ApiTags('workspaces')
@ApiBearerAuth()
@Controller('api/v1/workspaces')
export class WorkspacesController {
  constructor(
    private readonly workspacesService: WorkspacesService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

  @ApiOperation({
    summary: 'Create a new workspace owned by the authenticated user',
  })
  @ApiResponse({ status: 201 })
  @UseGuards(JwtAuthGuard)
  @Post()
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateWorkspaceDto,
  ) {
    const user = await this.usersService.findOrProvisionFromPrincipal(req.user);

    if (!user) {
      throw new NotFoundException('User could not be found or provisioned');
    }

    return this.workspacesService.createWorkspace(user.id, dto.name);
  }

  @ApiOperation({
    summary: 'List workspaces available to the authenticated user',
  })
  @ApiResponse({ status: 200 })
  @UseGuards(JwtAuthGuard)
  @Get()
  async list(
    @Req() req: AuthenticatedRequest,
    @Query() query: PaginationQueryDto,
  ) {
    const user = await this.usersService.findOrProvisionFromPrincipal(req.user);

    if (!user) {
      throw new NotFoundException('User could not be found or provisioned');
    }

    const pageSize = this.configService.get<number>('PAGE_SIZE', 20);

    return this.workspacesService.listWorkspaces(
      user.id,
      query.page ?? 1,
      pageSize,
    );
  }

  @ApiOperation({ summary: "Get the authenticated user's current workspace" })
  @ApiResponse({ status: 200 })
  @UseGuards(JwtAuthGuard)
  @Get('current')
  async getCurrent(@Req() req: AuthenticatedRequest) {
    const user = await this.usersService.findOrProvisionFromPrincipal(req.user);

    if (!user) {
      throw new NotFoundException('User could not be found or provisioned');
    }

    return this.workspacesService.getCurrentWorkspace(user.id);
  }

  @ApiOperation({
    summary: "Switch the authenticated user's current workspace",
  })
  @ApiResponse({ status: 200 })
  @UseGuards(JwtAuthGuard)
  @Put('current')
  async switchCurrent(
    @Req() req: AuthenticatedRequest,
    @Body() dto: SwitchWorkspaceDto,
  ) {
    const user = await this.usersService.findOrProvisionFromPrincipal(req.user);

    if (!user) {
      throw new NotFoundException('User could not be found or provisioned');
    }

    return this.workspacesService.switchCurrentWorkspace(
      user.id,
      dto.workspaceId,
    );
  }

  @ApiOperation({
    summary:
      'Permanently delete a workspace owned by the authenticated user, and everything in it',
  })
  @ApiResponse({ status: 200 })
  @UseGuards(JwtAuthGuard)
  @Delete(':workspaceId')
  async remove(
    @Req() req: AuthenticatedRequest,
    @Param('workspaceId') workspaceId: string,
  ) {
    const user = await this.usersService.findOrProvisionFromPrincipal(req.user);

    if (!user) {
      throw new NotFoundException('User could not be found or provisioned');
    }

    return this.workspacesService.deleteWorkspace(user.id, workspaceId);
  }
}
