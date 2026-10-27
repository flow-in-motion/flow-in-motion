import { validate } from 'class-validator';
import { CreateConferenceDto } from './create-conference.dto';
import { UpdateConferenceDto } from './update-conference.dto';

describe.each([
  ['create', CreateConferenceDto],
  ['update', UpdateConferenceDto],
] as const)('%s conference website', (_label, Dto) => {
  it.each([
    ['omitted', undefined, true],
    ['cleared', null, true],
    ['HTTPS website', 'https://conference.example.org', true],
    ['HTTP website', 'http://conference.example.org', true],
    [
      'website with a path and query',
      'https://conference.example.org/2027?track=research',
      true,
    ],
    ['missing protocol', 'conference.example.org', false],
    ['relative path', '/conference', false],
    ['script URL', 'javascript:alert(1)', false],
    ['email URL', 'mailto:organiser@example.org', false],
    ['FTP URL', 'ftp://conference.example.org', false],
    [
      'embedded credentials',
      'https://user:password@conference.example.org',
      false,
    ],
    ['non-text value', 123, false],
    [
      'oversized URL',
      `https://conference.example.org/${'a'.repeat(2048)}`,
      false,
    ],
  ])('%s', async (_description, websiteUrl, valid) => {
    const input = Object.assign(new Dto(), {
      name: 'Research conference',
      websiteUrl,
    });

    const errors = await validate(input);
    const websiteErrors = errors.filter(
      (error) => error.property === 'websiteUrl',
    );

    expect(websiteErrors.length === 0).toBe(valid);
  });
});
