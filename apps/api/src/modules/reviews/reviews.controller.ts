import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedPrincipal } from '../auth/jwt.strategy';
import { TenantMemberGuard } from '../memberships/policies/tenant-member.guard';
import { UsersService } from '../users/users.service';
import {
  CreateExaminationDto,
  CreateJournalReviewDto,
  ReviewKind,
  SaveReviewNoteDto,
  UpdateExaminationDto,
  UpdateJournalReviewDto,
} from './dto/review.dto';
import { ReviewsService } from './reviews.service';

interface AuthenticatedRequest extends Request {
  user: AuthenticatedPrincipal;
}
@ApiTags('Reviews and HDR examinations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantMemberGuard)
@Controller('api/v1/tenant/:tenantId/reviews')
export class ReviewsController {
  constructor(
    private readonly service: ReviewsService,
    private readonly users: UsersService,
  ) {}
  private async caller(req: AuthenticatedRequest) {
    return (await this.users.findByExternalAuthId(req.user.sub)).id;
  }

  @Get(':kind')
  async list(
    @Param('tenantId', ParseUUIDPipe) tenant: string,
    @Param('kind', new ParseEnumPipe(ReviewKind)) kind: ReviewKind,
    @Req() req: AuthenticatedRequest,
    @Query() query: PaginationQueryDto,
  ) {
    return this.service.list(tenant, await this.caller(req), kind, query);
  }
  @Get(':kind/:recordId')
  async detail(
    @Param('tenantId', ParseUUIDPipe) tenant: string,
    @Param('kind', new ParseEnumPipe(ReviewKind)) kind: ReviewKind,
    @Param('recordId', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.detail(tenant, await this.caller(req), kind, id);
  }
  @Post('examination')
  async createExamination(
    @Param('tenantId', ParseUUIDPipe) tenant: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateExaminationDto,
  ) {
    return this.service.create(
      tenant,
      await this.caller(req),
      ReviewKind.Examination,
      dto,
    );
  }
  @Post('journal')
  async createJournal(
    @Param('tenantId', ParseUUIDPipe) tenant: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateJournalReviewDto,
  ) {
    return this.service.create(
      tenant,
      await this.caller(req),
      ReviewKind.Journal,
      dto,
    );
  }
  @Patch('examination/:recordId')
  async updateExamination(
    @Param('tenantId', ParseUUIDPipe) tenant: string,
    @Param('recordId', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateExaminationDto,
  ) {
    return this.service.update(
      tenant,
      await this.caller(req),
      ReviewKind.Examination,
      id,
      dto,
    );
  }
  @Patch('journal/:recordId')
  async updateJournal(
    @Param('tenantId', ParseUUIDPipe) tenant: string,
    @Param('recordId', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateJournalReviewDto,
  ) {
    return this.service.update(
      tenant,
      await this.caller(req),
      ReviewKind.Journal,
      id,
      dto,
    );
  }
  @Delete(':kind/:recordId')
  async remove(
    @Param('tenantId', ParseUUIDPipe) tenant: string,
    @Param('kind', new ParseEnumPipe(ReviewKind)) kind: ReviewKind,
    @Param('recordId', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.remove(tenant, await this.caller(req), kind, id);
  }
  @Post(':kind/:recordId/notes')
  async addNote(
    @Param('tenantId', ParseUUIDPipe) tenant: string,
    @Param('kind', new ParseEnumPipe(ReviewKind)) kind: ReviewKind,
    @Param('recordId', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: SaveReviewNoteDto,
  ) {
    return this.service.saveNote(
      tenant,
      await this.caller(req),
      kind,
      id,
      dto.content,
    );
  }
  @Patch(':kind/:recordId/notes/:noteId')
  async updateNote(
    @Param('tenantId', ParseUUIDPipe) tenant: string,
    @Param('kind', new ParseEnumPipe(ReviewKind)) kind: ReviewKind,
    @Param('recordId', ParseUUIDPipe) id: string,
    @Param('noteId', ParseUUIDPipe) noteId: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: SaveReviewNoteDto,
  ) {
    return this.service.saveNote(
      tenant,
      await this.caller(req),
      kind,
      id,
      dto.content,
      noteId,
    );
  }
  @Delete(':kind/:recordId/notes/:noteId')
  async removeNote(
    @Param('tenantId', ParseUUIDPipe) tenant: string,
    @Param('kind', new ParseEnumPipe(ReviewKind)) kind: ReviewKind,
    @Param('recordId', ParseUUIDPipe) id: string,
    @Param('noteId', ParseUUIDPipe) noteId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.removeNote(
      tenant,
      await this.caller(req),
      kind,
      id,
      noteId,
    );
  }
}
