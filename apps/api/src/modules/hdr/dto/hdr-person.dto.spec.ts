import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CreateHdrPersonDto,
  ListHdrPeopleDto,
  UpdateHdrPersonDto,
} from './hdr-person.dto';

describe('HDR input validation', () => {
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
});
