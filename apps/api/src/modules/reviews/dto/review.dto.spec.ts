import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CreateExaminationDto,
  CreateJournalReviewDto,
  SaveReviewNoteDto,
  UpdateExaminationDto,
  UpdateJournalReviewDto,
} from './review.dto';

describe('Reviews and examination input validation', () => {
  const options = { whitelist: true, forbidNonWhitelisted: true };
  it('accepts name-only examinations and title-only journal reviews', async () => {
    expect(
      await validate(
        plainToInstance(CreateExaminationDto, { studentName: ' Student ' }),
        options,
      ),
    ).toHaveLength(0);
    expect(
      await validate(
        plainToInstance(CreateJournalReviewDto, {
          manuscriptTitle: ' Manuscript ',
        }),
        options,
      ),
    ).toHaveLength(0);
  });
  it.each([undefined, null, '', '   '])(
    'rejects missing or blank required fields: %s',
    async (value) => {
      expect(
        (
          await validate(
            plainToInstance(CreateExaminationDto, { studentName: value }),
            options,
          )
        ).length,
      ).toBeGreaterThan(0);
      expect(
        (
          await validate(
            plainToInstance(CreateJournalReviewDto, { manuscriptTitle: value }),
            options,
          )
        ).length,
      ).toBeGreaterThan(0);
    },
  );
  it('permits omitted fields on edit and explicit null on optional fields', async () => {
    expect(
      await validate(
        plainToInstance(UpdateExaminationDto, {
          dueOn: null,
          degreeType: null,
          fee: null,
        }),
        options,
      ),
    ).toHaveLength(0);
    expect(
      await validate(
        plainToInstance(UpdateJournalReviewDto, { journalRanking: null }),
        options,
      ),
    ).toHaveLength(0);
    expect(
      (
        await validate(
          plainToInstance(UpdateExaminationDto, { studentName: null }),
          options,
        )
      ).length,
    ).toBeGreaterThan(0);
    expect(
      (
        await validate(
          plainToInstance(UpdateJournalReviewDto, { manuscriptTitle: null }),
          options,
        )
      ).length,
    ).toBeGreaterThan(0);
  });
  it.each(['2027-02-30', '2027-13-01', '2027-01-01T12:00:00Z', 'tomorrow'])(
    'rejects invalid or non-calendar dates: %s',
    async (dueOn) => {
      expect(
        (
          await validate(
            plainToInstance(UpdateExaminationDto, { dueOn }),
            options,
          )
        ).length,
      ).toBeGreaterThan(0);
    },
  );
  it('keeps student IDs as strings and supports all approved degree choices', async () => {
    for (const degreeType of ['PhD', 'MRes', 'Masters', 'Other']) {
      const value = plainToInstance(CreateExaminationDto, {
        studentName: 'Student',
        studentNumber: '001234',
        degreeType,
      });
      expect(await validate(value, options)).toHaveLength(0);
      expect(value.studentNumber).toBe('001234');
    }
    expect(
      (
        await validate(
          plainToInstance(UpdateExaminationDto, { degreeType: 'Unknown' }),
          options,
        )
      ).length,
    ).toBeGreaterThan(0);
  });
  it('rejects cross-type fields, reassignment fields and notes smuggled into metadata edits', async () => {
    for (const extra of [
      { studentName: 'Student' },
      { kind: 'examination' },
      { ownerUserId: 'other' },
      { tenantId: 'other' },
      { initialNote: 'Cannot update notes this way' },
    ]) {
      expect(
        (
          await validate(
            plainToInstance(UpdateJournalReviewDto, extra),
            options,
          )
        ).length,
      ).toBeGreaterThan(0);
    }
  });
  it('rejects blank and oversized notes and preserves line breaks', async () => {
    expect(
      (
        await validate(
          plainToInstance(SaveReviewNoteDto, { content: '  ' }),
          options,
        )
      ).length,
    ).toBeGreaterThan(0);
    expect(
      (
        await validate(
          plainToInstance(SaveReviewNoteDto, { content: 'x'.repeat(20001) }),
          options,
        )
      ).length,
    ).toBeGreaterThan(0);
    const note = plainToInstance(SaveReviewNoteDto, {
      content: ' First line\nSecond line ',
    });
    expect(await validate(note, options)).toHaveLength(0);
    expect(note.content).toBe('First line\nSecond line');
  });
});
