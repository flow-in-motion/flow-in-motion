import {
  prefetchSupabaseSigningKeys,
  resetSupabaseSigningKeys,
  supabaseJwksUri,
} from './supabase-signing-keys';

const uri = supabaseJwksUri('https://project.supabase.co/');
const keys = [{ kid: 'k1', kty: 'RSA', alg: 'RS256', use: 'sig' }];

describe('Supabase signing-key prefetch', () => {
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    resetSupabaseSigningKeys();
    jest.useRealTimers();
    fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ keys }), { status: 200 }),
      );
  });

  afterEach(() => fetchMock.mockRestore());

  it('builds the same JWKS address the token check uses', () => {
    expect(uri).toBe(
      'https://project.supabase.co/auth/v1/.well-known/jwks.json',
    );
  });

  it('fetches once and shares the result', async () => {
    await expect(prefetchSupabaseSigningKeys(uri)).resolves.toEqual(keys);
    await expect(prefetchSupabaseSigningKeys(uri)).resolves.toEqual(keys);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('fetches again after ten minutes, matching the jwks-rsa cache', async () => {
    jest.useFakeTimers();
    await prefetchSupabaseSigningKeys(uri);
    jest.advanceTimersByTime(10 * 60 * 1000 + 1);
    await prefetchSupabaseSigningKeys(uri);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('returns no keys instead of failing when the endpoint is down', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));
    await expect(prefetchSupabaseSigningKeys(uri)).resolves.toEqual([]);
  });

  it('returns no keys for an error response', async () => {
    fetchMock.mockResolvedValueOnce(new Response('nope', { status: 503 }));
    await expect(prefetchSupabaseSigningKeys(uri)).resolves.toEqual([]);
  });
});
