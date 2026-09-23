import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ProjectScopedPaginationQueryDto } from './dto/pagination-query.dto';
import { assertAllFits, listPageSize, searchPattern } from './pagination';

describe('bounded list pagination', () => {
  it('keeps All explicit and bounds it without silently dropping records', () => {
    expect(listPageSize('all')).toBe(5000);
    expect(() => assertAllFits('all', 5000)).not.toThrow();
    expect(() => assertAllFits('all', 5001)).toThrow('All is limited');
    expect(() => assertAllFits(100, 5001)).not.toThrow();
  });

  it.each(['20', '50', '100', 'all'])('accepts pageSize=%s', async (pageSize) => {
    const dto = plainToInstance(ProjectScopedPaginationQueryDto, { pageSize });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.pageSize).toBe(pageSize === 'all' ? 'all' : Number(pageSize));
  });

  it.each(['0', '101', '5001', 'Infinity', 'invalid'])('rejects pageSize=%s', async (pageSize) => {
    expect(await validate(plainToInstance(ProjectScopedPaginationQueryDto, { pageSize }))).not.toHaveLength(0);
  });

  it('parses false as false and rejects malformed scopes and oversized searches', async () => {
    const dto = plainToInstance(ProjectScopedPaginationQueryDto, { projectOnly: 'false' });
    expect(dto.projectOnly).toBe(false);
    expect(await validate(dto)).toHaveLength(0);
    expect(await validate(plainToInstance(ProjectScopedPaginationQueryDto, { projectOnly: 'yes', search: 'a'.repeat(201) }))).toHaveLength(2);
  });

  it('searches literal wildcard characters rather than broadening the query', () => {
    expect(searchPattern('50%_\\')).toBe('%50\\%\\_\\\\%');
  });
});
