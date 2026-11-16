import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateModuleDto } from './create-module.dto';
import { UpdateModuleDto } from './update-module.dto';

describe('paper planning and references', () => {
  it('keeps all new fields optional for existing create and edit requests', async () => {
    expect(
      await validate(plainToInstance(CreateModuleDto, { shortTitle: 'Paper' })),
    ).toHaveLength(0);
    expect(
      await validate(plainToInstance(UpdateModuleDto, { status: 'Active' })),
    ).toHaveLength(0);
  });

  it('accepts work planning independently of a due date and trims named publishers', async () => {
    const dto = plainToInstance(CreateModuleDto, {
      shortTitle: 'Paper',
      workingDate: '2027-01-12',
      plannedHours: 1.5,
      manuscriptUrl: 'https://university.example/manuscript?id=24',
      dataUrl: 'https://repository.example/data',
      otherFilesUrl: null,
      journalPublishers: [
        { journalName: ' Nature ', publisher: ' Springer Nature ' },
      ],
    });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.dueDate).toBeUndefined();
    expect(dto.journalPublishers).toEqual([
      { journalName: 'Nature', publisher: 'Springer Nature' },
    ]);
  });

  it('supports clearing each optional field on edit without requiring another field', async () => {
    expect(
      await validate(
        plainToInstance(UpdateModuleDto, {
          workingDate: null,
          plannedHours: null,
          manuscriptUrl: null,
          dataUrl: null,
          otherFilesUrl: null,
          journalPublishers: [],
        }),
      ),
    ).toHaveLength(0);
  });

  it.each([0, -1, 24.01, 1.234, '1.5', 'invalid', Infinity])(
    'rejects invalid planned hours: %s',
    async (plannedHours) => {
      expect(
        (await validate(plainToInstance(UpdateModuleDto, { plannedHours })))
          .length,
      ).toBeGreaterThan(0);
    },
  );

  it.each(['2027-02-30', 'tomorrow', '2027-01-12T23:00:00Z'])(
    'rejects an invalid working day: %s',
    async (workingDate) => {
      expect(
        (await validate(plainToInstance(UpdateModuleDto, { workingDate })))
          .length,
      ).toBeGreaterThan(0);
    },
  );

  it.each([
    'javascript:alert(1)',
    'data:text/html,example',
    'file:///tmp/paper',
    'ftp://example.org/paper',
    'https://user:password@example.org/paper',
    'not a URL',
  ])('rejects unsafe or invalid paper links: %s', async (url) => {
    for (const field of ['manuscriptUrl', 'dataUrl', 'otherFilesUrl']) {
      expect(
        (await validate(plainToInstance(UpdateModuleDto, { [field]: url })))
          .length,
      ).toBeGreaterThan(0);
    }
  });

  it.each([
    null,
    {},
    [{ journalName: 'Journal' }],
    [{ journalName: ' ', publisher: 'Publisher' }],
    [{ journalName: 'Journal', publisher: ' ' }],
  ])('rejects malformed publisher details: %j', async (journalPublishers) => {
    expect(
      (await validate(plainToInstance(UpdateModuleDto, { journalPublishers })))
        .length,
    ).toBeGreaterThan(0);
  });
});
