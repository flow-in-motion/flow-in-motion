import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateFeedbackDto } from '../dto/create-feedback.dto';
import { UpdateFeedbackDto } from '../dto/update-feedback.dto';
import { FeedbackRepository } from '../repositories/feedback.repository';
import {
  buildPaginationMeta,
  paginationOffset,
} from '../../../common/pagination';
import { FeedbackEmailService } from './feedback-email.service';

@Injectable()
export class FeedbackService {
  constructor(
    private readonly repository: FeedbackRepository,
    private readonly feedbackEmailService: FeedbackEmailService,
  ) {}

  async list(
    tenantId: string,
    callerUserId: string,
    page: number,
    pageSize: number,
  ) {
    const offset = paginationOffset(page, pageSize);

    const { data, totalItems } = await this.repository.findPageByUser(
      tenantId,
      callerUserId,
      offset,
      pageSize,
    );

    return {
      data,
      meta: buildPaginationMeta(page, pageSize, totalItems),
    };
  }

  async findOne(tenantId: string, feedbackId: string, callerUserId: string) {
    const feedback = await this.repository.findByIdAndUser(
      tenantId,
      feedbackId,
      callerUserId,
    );

    if (!feedback) {
      throw new NotFoundException('Feedback not found');
    }

    return feedback;
  }

  async create(
    tenantId: string,
    callerUserId: string,
    input: CreateFeedbackDto,
  ) {
    const feedback = await this.repository.create({
      tenantId,
      userId: callerUserId,
      message: input.message.trim(),
      rating: input.rating,
    });

    if (!feedback) {
      throw new NotFoundException('Failed to create feedback');
    }
    await this.feedbackEmailService.sendFeedbackNotification({
      feedbackId: feedback.id,
      tenantId: feedback.tenantId,
      userId: feedback.userId,
      message: feedback.message,
      rating: feedback.rating,
      submittedAt: feedback.createdAt,
    });

    return feedback;
  }

  async update(
    tenantId: string,
    feedbackId: string,
    callerUserId: string,
    input: UpdateFeedbackDto,
  ) {
    await this.findOne(tenantId, feedbackId, callerUserId);

    const feedback = await this.repository.update(
      tenantId,
      feedbackId,
      callerUserId,
      {
        message: input.message !== undefined ? input.message.trim() : undefined,
        rating: input.rating,
      },
    );

    if (!feedback) {
      throw new NotFoundException('Feedback not found');
    }

    return feedback;
  }

  async remove(tenantId: string, feedbackId: string, callerUserId: string) {
    await this.findOne(tenantId, feedbackId, callerUserId);

    const feedback = await this.repository.remove(
      tenantId,
      feedbackId,
      callerUserId,
    );

    if (!feedback) {
      throw new NotFoundException('Feedback not found');
    }

    return {
      message: 'Feedback deleted successfully',
      feedback,
    };
  }
}
