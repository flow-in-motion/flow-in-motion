// apps/api/src/modules/notes/controllers/my-notes.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Req,
  UseGuards,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import type { AuthenticatedPrincipal } from '../../auth/jwt.strategy';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { UsersService } from '../../users/users.service';
import { UpdateNoteDto } from '../dto/update-note.dto';
import { NotesService } from '../services/notes.service';
import { CreateNoteEntryDto } from '../dto/create-note-entry.dto';

interface AuthenticatedRequest extends Request {
  user: AuthenticatedPrincipal;
}

/**
 * Tenant-agnostic view of notes the caller can access — a note the caller
 * created or was explicitly added to as a member, regardless of which
 * workspace it belongs to. Guarded by JwtAuthGuard only, not
 * TenantMemberGuard, mirroring MyTasksController.
 */
@ApiTags('notes')
@ApiBearerAuth()
@Controller('api/v1/me/notes')
export class MyNotesController {
  constructor(
    private readonly notesService: NotesService,
    private readonly usersService: UsersService,
  ) {}

  @ApiOperation({
    summary: 'List every note the caller can access, across all workspaces',
  })
  @UseGuards(JwtAuthGuard)
  @Get()
  async list(@Req() req: AuthenticatedRequest) {
    const user = await this.usersService.findByExternalAuthId(req.user.sub);
    return this.notesService.listForCaller(user.id);
  }

  @ApiOperation({ summary: 'Get a single note the caller can access' })
  @UseGuards(JwtAuthGuard)
  @Get(':noteId')
  async findOne(
    @Param('noteId') noteId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const user = await this.usersService.findByExternalAuthId(req.user.sub);
    return this.notesService.findOneForCaller(noteId, user.id);
  }

  @ApiOperation({ summary: 'Update a note the caller can access' })
  @UseGuards(JwtAuthGuard)
  @Patch(':noteId')
  async update(
    @Param('noteId') noteId: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateNoteDto,
  ) {
    const user = await this.usersService.findByExternalAuthId(req.user.sub);
    return this.notesService.updateForCaller(noteId, user.id, dto);
  }

  @ApiOperation({
    summary: 'Add a dated entry to a note the caller can access',
  })
  @UseGuards(JwtAuthGuard)
  @Post(':noteId/entries')
  async appendEntry(
    @Param('noteId') noteId: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateNoteEntryDto,
  ) {
    const user = await this.usersService.findByExternalAuthId(req.user.sub);

    return this.notesService.appendEntryForCaller(noteId, user.id, dto);
  }

  @ApiOperation({ summary: 'Delete a note the caller can access' })
  @UseGuards(JwtAuthGuard)
  @Delete(':noteId')
  async remove(
    @Param('noteId') noteId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const user = await this.usersService.findByExternalAuthId(req.user.sub);
    return this.notesService.deleteForCaller(noteId, user.id);
  }
}
