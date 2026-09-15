// apps/api/src/modules/note-invitations/controllers/note-invitations.controller.ts
import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
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
import { NotesRepository } from '../../notes/repositories/notes.repository';
import { InviteCollaboratorDto } from '../dto/invite-collaborator.dto';
import { NoteInvitationsService } from '../services/note-invitations.service';

interface AuthenticatedRequest extends Request {
  user: AuthenticatedPrincipal;
}

@ApiTags('note-invitations')
@ApiBearerAuth()
@Controller('api/v1/tenant/:tenantId/notes/:noteId/invitations')
export class NoteInvitationsController {
  constructor(
    private readonly service: NoteInvitationsService,
    private readonly usersService: UsersService,
    private readonly notesRepository: NotesRepository,
  ) {}

  private async assertOwner(
    tenantId: string,
    noteId: string,
    req: AuthenticatedRequest,
  ) {
    const user = await this.usersService.findByExternalAuthId(req.user.sub);
    const note = await this.notesRepository.findById(tenantId, noteId);
    if (!note) {
      throw new NotFoundException('Note not found');
    }
    if (note.createdBy !== user.id) {
      throw new ForbiddenException(
        'Only the note creator can manage invitations',
      );
    }
    return user;
  }

  @ApiOperation({
    summary: 'List invitations for this note (creator only)',
  })
  @UseGuards(JwtAuthGuard, TenantMemberGuard)
  @Get()
  async list(
    @Param('tenantId') tenantId: string,
    @Param('noteId') noteId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.assertOwner(tenantId, noteId, req);
    return this.service.list(noteId);
  }

  @ApiOperation({
    summary:
      'Add a draft collaborator by name/email/affiliation (creator only) — nothing is sent yet',
  })
  @ApiResponse({ status: 201 })
  @UseGuards(JwtAuthGuard, TenantMemberGuard)
  @Post()
  async createDraft(
    @Param('tenantId') tenantId: string,
    @Param('noteId') noteId: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: InviteCollaboratorDto,
  ) {
    const user = await this.assertOwner(tenantId, noteId, req);
    return this.service.createDraft(noteId, user.id, dto);
  }

  @ApiOperation({
    summary:
      'Send the invitation email for a draft collaborator (creator only)',
  })
  @ApiResponse({ status: 201 })
  @ApiResponse({ status: 503, description: 'Email delivery unavailable' })
  @UseGuards(JwtAuthGuard, TenantMemberGuard)
  @Post(':id/send')
  async send(
    @Param('tenantId') tenantId: string,
    @Param('noteId') noteId: string,
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.assertOwner(tenantId, noteId, req);
    return this.service.send(noteId, id);
  }

  @ApiOperation({ summary: 'Revoke a pending invitation (creator only)' })
  @UseGuards(JwtAuthGuard, TenantMemberGuard)
  @Delete(':id')
  async revoke(
    @Param('tenantId') tenantId: string,
    @Param('noteId') noteId: string,
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.assertOwner(tenantId, noteId, req);
    return this.service.revoke(noteId, id);
  }
}
