import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CreateTimeEntryDto,
  UpdateTimeEntryDto,
} from '../dto/paper-time-entry.dto';
import {
  PaperTimeEntriesRepository,
  type TimeEntryRow,
} from '../repositories/paper-time-entries.repository';
import { ProjectModulesRepository } from '../repositories/project-modules.repository';

/** Time added by hand can't be dated more than a day ahead (time zones). */
const MAX_FUTURE_MS = 24 * 60 * 60 * 1000;

function isUniqueViolation(error: unknown) {
  const candidates = [error, (error as { cause?: unknown })?.cause];
  return candidates.some(
    (candidate) =>
      typeof candidate === 'object' &&
      candidate !== null &&
      (candidate as { code?: unknown }).code === '23505',
  );
}

function entryResponse(row: TimeEntryRow) {
  const isOpen = row.endedAt === null;
  const isRunning = isOpen && row.runningSince !== null;
  return {
    id: row.id,
    paperId: row.paperId,
    source: row.source as 'timer' | 'manual',
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    note: row.note,
    isOpen,
    isRunning,
    /** Logged so far, not counting the stretch running right now. */
    durationSeconds: row.durationSeconds,
    /** The stretch running right now (0 when paused or stopped). */
    runningSeconds: isRunning ? row.runningSeconds : 0,
  };
}

/**
 * Logging time on papers: one paper timer per person, independent of task timers (Start, Pause, Resume, Stop),
 * plus time added or corrected by hand. Each person sees and edits only their
 * own entries; a paper's total includes everyone's.
 */
@Injectable()
export class PaperTimeEntriesService {
  constructor(
    private readonly repository: PaperTimeEntriesRepository,
    private readonly papers: ProjectModulesRepository,
  ) {}

  /** A paper the caller created or was added to, or 404. */
  private async accessiblePaper(paperId: string, userId: string) {
    const paper = await this.papers.findByIdGlobal(paperId);
    if (
      paper &&
      (await this.papers.checkAccessForGuard(paper.tenantId, paper.id, userId))
    ) {
      return paper;
    }
    throw new NotFoundException('Paper not found');
  }

  /** The caller's running or paused timer, or null. */
  async current(userId: string) {
    const open = await this.repository.findOpen(userId);
    if (!open) return null;

    // The person lost access to the paper: stop the timer, keeping the time.
    if (open.paperTitle === null) {
      await this.repository.stop(open.id, userId);
      return null;
    }

    const entry = entryResponse(open);
    return {
      ...entry,
      tenantId: open.tenantId,
      paperTitle: open.paperTitle,
      paperDisplayId: open.paperDisplayId,
      elapsedSeconds: entry.durationSeconds + entry.runningSeconds,
    };
  }

  /** Starts timing a paper. Any other open paper timer is stopped first. */
  async start(userId: string, paperId: string) {
    const paper = await this.accessiblePaper(paperId, userId);
    const open = await this.repository.lockOpen(userId);

    if (open?.paperId === paper.id) {
      if (open.runningSince === null) {
        await this.repository.resume(open.id, userId);
      }
      return this.current(userId);
    }

    if (open) await this.repository.stop(open.id, userId);

    try {
      await this.repository.startTimer({
        tenantId: paper.tenantId,
        paperId: paper.id,
        userId,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          'Another timer was just started. Refresh the page and try again.',
        );
      }
      throw error;
    }
    return this.current(userId);
  }

  async pause(userId: string) {
    const open = await this.repository.lockOpen(userId);
    if (!open) throw new NotFoundException('No timer is running');
    if (open.runningSince !== null) {
      await this.repository.pause(open.id, userId);
    }
    return this.current(userId);
  }

  async resume(userId: string) {
    const open = await this.repository.lockOpen(userId);
    if (!open) throw new NotFoundException('No timer is running');
    if (open.runningSince === null) {
      await this.repository.resume(open.id, userId);
    }
    return this.current(userId);
  }

  /** Stops the open timer. Returns the finished entry, or null if none. */
  async stop(userId: string) {
    const open = await this.repository.lockOpen(userId);
    if (!open) return null;
    const stopped = await this.repository.stop(open.id, userId);
    return stopped ? entryResponse(stopped) : null;
  }

  /** The caller's entries on a paper, with the paper's logged totals. */
  async listForPaper(paperId: string, userId: string) {
    const paper = await this.accessiblePaper(paperId, userId);
    const [entries, totals] = await Promise.all([
      this.repository.findForPaper(paper.id, userId),
      this.repository.totalsForPapers([paper.id], userId),
    ]);
    const logged = totals.get(paper.id);
    return {
      paperId: paper.id,
      entries: entries.map(entryResponse),
      mySeconds: logged?.mySeconds ?? 0,
      totalSeconds: logged?.totalSeconds ?? 0,
    };
  }

  private parseStart(startedAt: string) {
    const date = new Date(startedAt);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('startedAt must be a valid date');
    }
    if (date.getTime() > Date.now() + MAX_FUTURE_MS) {
      throw new BadRequestException("Time can't be logged in the future");
    }
    return date;
  }

  /** Adds time by hand, for work that wasn't timed. */
  async addManual(paperId: string, userId: string, dto: CreateTimeEntryDto) {
    const paper = await this.accessiblePaper(paperId, userId);
    const row = await this.repository.addManual({
      tenantId: paper.tenantId,
      paperId: paper.id,
      userId,
      startedAt: this.parseStart(dto.startedAt),
      durationSeconds: dto.minutes * 60,
      note: dto.note?.trim() || null,
    });
    if (!row) throw new NotFoundException('Paper not found');
    return entryResponse(row);
  }

  /** Corrects one of the caller's finished entries. */
  async update(entryId: string, userId: string, dto: UpdateTimeEntryDto) {
    const entry = await this.repository.findOwn(entryId, userId);
    if (!entry) throw new NotFoundException('Time entry not found');
    if (entry.endedAt === null) {
      throw new BadRequestException(
        'Stop the timer before changing this entry',
      );
    }

    const row = await this.repository.updateFinished(entryId, userId, {
      startedAt:
        dto.startedAt === undefined
          ? entry.startedAt
          : this.parseStart(dto.startedAt),
      durationSeconds:
        dto.minutes === undefined ? entry.durationSeconds : dto.minutes * 60,
      note: dto.note === undefined ? entry.note : dto.note?.trim() || null,
    });
    if (!row) throw new NotFoundException('Time entry not found');
    return entryResponse(row);
  }

  /** Deletes one of the caller's finished entries. */
  async remove(entryId: string, userId: string) {
    const entry = await this.repository.findOwn(entryId, userId);
    if (!entry) throw new NotFoundException('Time entry not found');
    if (entry.endedAt === null) {
      throw new BadRequestException('Stop the timer before deleting it');
    }
    const deleted = await this.repository.deleteFinished(entryId, userId);
    if (!deleted) throw new NotFoundException('Time entry not found');
    return deleted;
  }
}
