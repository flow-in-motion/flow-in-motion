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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiQuery,
} from '@nestjs/swagger';
import { Request } from 'express';
import type { AuthenticatedPrincipal } from '../../auth/jwt.strategy';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { UsersService } from '../../users/users.service';
import { CreateNoteDto } from '../dto/create-note.dto';
import { UpdateNoteDto } from '../dto/update-note.dto';
import { NotesService } from '../services/notes.service';
import { TenantMemberGuard } from '../../memberships/policies/tenant-member.guard';
import { ConfigService } from '@nestjs/config';
import { ProjectScopedPaginationQueryDto } from '../../../common/dto/pagination-query.dto';
interface AuthenticatedRequest extends Request {
  user: AuthenticatedPrincipal;
}

@ApiTags('notes')
@ApiBearerAuth()
@Controller('api/v1/tenant/:tenantId/notes')
export class NotesController {
  constructor(
    private readonly notesService: NotesService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

  @ApiOperation({
    summary: 'List notes for a workspace, optionally filtered by project',
  })
  @ApiQuery({ name: 'projectId', required: false, type: String })
  @UseGuards(JwtAuthGuard, TenantMemberGuard)
  @Get()
  async list(
    @Param('tenantId') tenantId: string,
    @Req() req: AuthenticatedRequest,
    @Query() query: ProjectScopedPaginationQueryDto,
  ) {
    const user = await this.usersService.findByExternalAuthId(req.user.sub);

    const pageSize = this.configService.get<number>('PAGE_SIZE', 20);

    return this.notesService.list(
      tenantId,
      user.id,
      query.page ?? 1,
      pageSize,
      query.projectId,
    );
  }

  @ApiOperation({ summary: 'Get a single note' })
  @UseGuards(JwtAuthGuard, TenantMemberGuard)
  @Get(':noteId')
  async findOne(
    @Param('tenantId') tenantId: string,
    @Param('noteId') noteId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const user = await this.usersService.findByExternalAuthId(req.user.sub);
    return this.notesService.findOne(tenantId, noteId, user.id);
  }

  @ApiOperation({
    summary: 'Create a note, optionally associated with a project and module',
  })
  @ApiResponse({ status: 201 })
  @UseGuards(JwtAuthGuard, TenantMemberGuard)
  @Post()
  async create(
    @Param('tenantId') tenantId: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateNoteDto,
  ) {
    const user = await this.usersService.findByExternalAuthId(req.user.sub);
    return this.notesService.create(tenantId, user.id, dto);
  }

  @ApiOperation({ summary: 'Update a note' })
  @UseGuards(JwtAuthGuard, TenantMemberGuard)
  @Patch(':noteId')
  async update(
    @Param('tenantId') tenantId: string,
    @Param('noteId') noteId: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateNoteDto,
  ) {
    const user = await this.usersService.findByExternalAuthId(req.user.sub);
    return this.notesService.update(tenantId, noteId, user.id, dto);
  }

  @ApiOperation({ summary: 'Delete a note' })
  @UseGuards(JwtAuthGuard, TenantMemberGuard)
  @Delete(':noteId')
  async remove(
    @Param('tenantId') tenantId: string,
    @Param('noteId') noteId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const user = await this.usersService.findByExternalAuthId(req.user.sub);
    return this.notesService.delete(tenantId, noteId, user.id);
  }
}
