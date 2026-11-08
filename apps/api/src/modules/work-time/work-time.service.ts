import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CreateTimeEntryDto,
  UpdateTimeEntryDto,
} from '../tasks/dto/time-entry.dto';
import {
  WorkTimeRepository,
  targetOf,
  type WorkTimeRow,
} from './work-time.repository';
import type { WorkTimeKind } from './work-time.dto';

function response(row: WorkTimeRow) {
  return {
    id: row.id,
    ...targetOf(row),
    source: row.source as 'timer' | 'manual',
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    note: row.note,
    isOpen: row.endedAt === null,
    isRunning: row.endedAt === null && row.runningSince !== null,
    durationSeconds: row.durationSeconds,
    runningSeconds: row.runningSeconds,
  };
}
@Injectable()
export class WorkTimeService {
  constructor(private readonly repository: WorkTimeRepository) {}
  private async accessible(
    kind: WorkTimeKind,
    targetId: string,
    userId: string,
  ) {
    const target = await this.repository.target(kind, targetId, userId);
    if (!target) throw new NotFoundException('Timer item not found');
    return target;
  }
  private async timer(row: WorkTimeRow, userId: string) {
    const target = targetOf(row);
    const parent = await this.repository.target(
      target.kind,
      target.targetId,
      userId,
    );
    if (!parent) {
      await this.repository.transition(row.id, userId, 'stop');
      return null;
    }
    return {
      ...response(row),
      title: parent.title || 'Untitled',
      tenantId: parent.tenantId,
    };
  }
  async current(userId: string) {
    const timers = [];
    for (const row of await this.repository.current(userId)) {
      const timer = await this.timer(row, userId);
      if (timer) timers.push(timer);
    }
    return { timers };
  }
  async start(kind: WorkTimeKind, targetId: string, userId: string) {
    const parent = await this.accessible(kind, targetId, userId);
    const open = await this.repository.openFor(kind, targetId, userId);
    if (open) {
      const row =
        open.runningSince === null
          ? await this.repository.transition(open.id, userId, 'resume')
          : open;
      return { timer: row ? await this.timer(row, userId) : null };
    }
    try {
      const created = await this.repository.create(
        kind,
        targetId,
        userId,
        parent.tenantId,
      );
      const row = created && (await this.repository.own(created.id, userId));
      if (!row) throw new NotFoundException('Timer item not found');
      return { timer: await this.timer(row, userId) };
    } catch (error) {
      const codes = [error, (error as { cause?: unknown })?.cause];
      if (codes.some((e) => (e as { code?: string })?.code === '23505'))
        throw new ConflictException(
          'This timer was just started. Refresh and try again.',
        );
      throw error;
    }
  }
  async transition(
    id: string,
    userId: string,
    action: 'pause' | 'resume' | 'stop',
  ) {
    const open = await this.repository.own(id, userId, true);
    if (!open || open.endedAt !== null)
      throw new NotFoundException('Open timer not found');
    if (action === 'resume') {
      const target = targetOf(open);
      await this.accessible(target.kind, target.targetId, userId);
    }
    // Repeated requests must not restart or discard a running stretch.
    const unchanged =
      (action === 'resume' && open.runningSince !== null) ||
      (action === 'pause' && open.runningSince === null);
    const row = unchanged
      ? open
      : await this.repository.transition(id, userId, action);
    return {
      timer: row
        ? action === 'stop'
          ? response(row)
          : await this.timer(row, userId)
        : null,
    };
  }
  async list(kind: WorkTimeKind, targetId: string, userId: string) {
    await this.accessible(kind, targetId, userId);
    const entries = await this.repository.list(kind, targetId, userId);
    return {
      entries: entries.map(response),
      mySeconds: entries.reduce((sum, row) => sum + row.durationSeconds, 0),
    };
  }
  private parseStart(value: string) {
    if (typeof value !== 'string')
      throw new BadRequestException('A valid date is required');
    const date = new Date(value);
    if (Number.isNaN(date.getTime()) || date.getTime() > Date.now() + 86400000)
      throw new BadRequestException(
        'Time must have a valid date and cannot be logged in the future',
      );
    return date;
  }
  async add(
    kind: WorkTimeKind,
    targetId: string,
    userId: string,
    dto: CreateTimeEntryDto,
  ) {
    const parent = await this.accessible(kind, targetId, userId);
    const created = await this.repository.create(
      kind,
      targetId,
      userId,
      parent.tenantId,
      { ...dto, startedAt: this.parseStart(dto.startedAt) },
    );
    const row = created && (await this.repository.own(created.id, userId));
    if (!row) throw new NotFoundException('Timer item not found');
    return response(row);
  }
  private async finished(id: string, userId: string) {
    const row = await this.repository.own(id, userId, true);
    if (!row) throw new NotFoundException('Time entry not found');
    if (!row.endedAt)
      throw new BadRequestException(
        'Stop the timer before changing this entry',
      );
    const target = targetOf(row);
    await this.accessible(target.kind, target.targetId, userId);
    return row;
  }
  async update(id: string, userId: string, dto: UpdateTimeEntryDto) {
    await this.finished(id, userId);
    if (
      dto.minutes !== undefined &&
      (!Number.isInteger(dto.minutes) || dto.minutes < 1 || dto.minutes > 1440)
    )
      throw new BadRequestException('Enter between 1 minute and 24 hours');
    const row = await this.repository.update(id, userId, {
      ...dto,
      startedAt:
        dto.startedAt === undefined
          ? undefined
          : this.parseStart(dto.startedAt),
    });
    if (!row) throw new NotFoundException('Time entry not found');
    return response(row);
  }
  async remove(id: string, userId: string) {
    await this.finished(id, userId);
    if (!(await this.repository.remove(id, userId)))
      throw new NotFoundException('Time entry not found');
    return { deleted: true };
  }
}
