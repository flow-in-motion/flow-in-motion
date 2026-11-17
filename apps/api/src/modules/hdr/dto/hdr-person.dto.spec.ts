import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CreateHdrPersonDto,
  ListHdrPeopleDto,
  SaveHdrNoteDto,
  UpdateHdrPersonDto,
} from './hdr-person.dto';

describe('HDR input validation', () => {
  it('accepts extended research topics without requiring any new field', async () => {
    expect(
      await validate(
        plainToInstance(CreateHdrPersonDto, {
          name: 'Student',
          researchTopic: 'a'.repeat(10000),
        }),
      ),
    ).toHaveLength(0);
    expect(
      (
        await validate(
          plainToInstance(UpdateHdrPersonDto, {
            researchTopic: 'a'.repeat(10001),
          }),
        )
      ).length,
    ).toBeGreaterThan(0);
  });
  it('allows a name-only record and optional contact details', async () => {
    expect(
      await validate(
        plainToInstance(CreateHdrPersonDto, { name: 'Sample Student' }),
      ),
    ).toHaveLength(0);
    expect(
      await validate(
        plainToInstance(CreateHdrPersonDto, {
          name: 'Sample Visitor',
          type: 'Visiting scholar',
          category: 'Potential',
          email: null,
          researchTopic: null,
          paperIds: [],
          projectIds: [],
        }),
      ),
    ).toHaveLength(0);
  });
  it.each(['name', 'type', 'category', 'paperIds', 'projectIds'])(
    'rejects null %s on edit',
    async (field) => {
      expect(
        (await validate(plainToInstance(UpdateHdrPersonDto, { [field]: null })))
          .length,
      ).toBeGreaterThan(0);
    },
  );
  it('permits partial edits without resetting other values', async () => {
    const dto = plainToInstance(UpdateHdrPersonDto, { name: 'Updated name' });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.paperIds).toBeUndefined();
    expect(dto.type).toBeUndefined();
  });
  it('rejects malformed and duplicate links, unsupported types, and invalid email', async () => {
    for (const input of [
      { paperIds: ['not-a-uuid'] },
      {
        projectIds: [
          '11111111-1111-4111-8111-111111111111',
          '11111111-1111-4111-8111-111111111111',
        ],
      },
      { type: 'Other' },
      { category: 'Unknown' },
      { email: 'invalid' },
    ])
      expect(
        (
          await validate(
            plainToInstance(CreateHdrPersonDto, { name: 'Student', ...input }),
          )
        ).length,
      ).toBeGreaterThan(0);
  });
  it('validates pagination and filters', async () => {
    expect(
      await validate(
        plainToInstance(ListHdrPeopleDto, {
          page: '2',
          pageSize: 'all',
          type: 'MRes',
          category: 'Current',
        }),
      ),
    ).toHaveLength(0);
    expect(
      (await validate(plainToInstance(ListHdrPeopleDto, { pageSize: 1000 })))
        .length,
    ).toBeGreaterThan(0);
  });

  it('allows all optional supervision values but rejects bad dates, types and client timestamps', async () => {
    const options = { whitelist: true, forbidNonWhitelisted: true };
    for (const supervisionType of [
      'Primary',
      'Associate',
      'Co-supervisor',
      'Panel',
      'Other',
      null,
    ])
      expect(
        await validate(
          plainToInstance(UpdateHdrPersonDto, {
            supervisionType,
            startDate: null,
            submissionDueDate: '2030-12-01',
            conferences: null,
          }),
          options,
        ),
      ).toHaveLength(0);
    for (const input of [
      { supervisionType: 'Unknown' },
      { startDate: '2027-02-30' },
      { submissionDueDate: 'tomorrow' },
      { createdAt: '2027-01-01' },
      { initialDiscussionNote: 'use notes endpoint on edit' },
    ])
      expect(
        (await validate(plainToInstance(UpdateHdrPersonDto, input), options))
          .length,
      ).toBeGreaterThan(0);
  });

  it('dates notes on the server and validates note content', async () => {
    const options = { whitelist: true, forbidNonWhitelisted: true };
    const dto = plainToInstance(SaveHdrNoteDto, { content: ' First\nSecond ' });
    expect(await validate(dto, options)).toHaveLength(0);
    expect(dto.content).toBe('First\nSecond');
    for (const input of [
      { content: ' ' },
      { content: 'x'.repeat(20001) },
      { content: 'Text', createdAt: '2027-01-01' },
    ])
      expect(
        (await validate(plainToInstance(SaveHdrNoteDto, input), options))
          .length,
      ).toBeGreaterThan(0);
  });
});
