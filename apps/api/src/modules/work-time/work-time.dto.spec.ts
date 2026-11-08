import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { WorkTimeTargetDto } from './work-time.dto';
import { CreateTimeEntryDto } from '../tasks/dto/time-entry.dto';
import {
  CreateProjectDto,
  PROJECT_STATUSES,
} from '../projects/dto/create-project.dto';
import { UpdateProjectDto } from '../projects/dto/update-project.dto';
describe('Work time and Project status input', () => {
  it.each(['project', 'note', 'hdr'])(
    'accepts only a valid %s target',
    async (kind) => {
      expect(
        await validate(
          plainToInstance(WorkTimeTargetDto, {
            kind,
            targetId: '11111111-1111-4111-8111-111111111111',
          }),
        ),
      ).toHaveLength(0);
    },
  );
  it.each([
    { kind: 'task', targetId: '11111111-1111-4111-8111-111111111111' },
    { kind: 'hdr', targetId: 'invalid' },
  ])('rejects an invalid timer target', async (input) => {
    expect(
      (await validate(plainToInstance(WorkTimeTargetDto, input))).length,
    ).toBeGreaterThan(0);
  });
  it.each([0, 1441, 1.5, null])(
    'rejects invalid manual minutes %s',
    async (minutes) => {
      expect(
        (
          await validate(
            plainToInstance(CreateTimeEntryDto, {
              startedAt: '2026-11-01T12:00:00Z',
              minutes,
            }),
          )
        ).length,
      ).toBeGreaterThan(0);
    },
  );
  it.each(PROJECT_STATUSES)(
    'accepts Project %s for creation and editing',
    async (status) => {
      expect(
        await validate(
          plainToInstance(CreateProjectDto, { title: 'Project', status }),
        ),
      ).toHaveLength(0);
      expect(
        await validate(plainToInstance(UpdateProjectDto, { status })),
      ).toHaveLength(0);
    },
  );
  it('rejects retired Review without removing internal archive behavior', async () => {
    expect(
      (await validate(plainToInstance(UpdateProjectDto, { status: 'Review' })))
        .length,
    ).toBeGreaterThan(0);
  });
});
