import { loadDatabaseSecretEnvironment } from './load-database-secret';

const DATABASE_KEYS = [
  'DATABASE_SECRET_ARN',
  'POSTGRES_HOST',
  'POSTGRES_PORT',
  'POSTGRES_DB',
  'POSTGRES_RUNTIME_USER',
  'POSTGRES_RUNTIME_PASSWORD',
  'POSTGRES_SSL_MODE',
] as const;

const originalEnvironment = Object.fromEntries(
  DATABASE_KEYS.map((key) => [key, process.env[key]]),
);

function clearDatabaseEnvironment() {
  for (const key of DATABASE_KEYS) {
    delete process.env[key];
  }
}

describe('loadDatabaseSecretEnvironment', () => {
  beforeEach(() => {
    clearDatabaseEnvironment();
  });

  afterAll(() => {
    clearDatabaseEnvironment();

    for (const [key, value] of Object.entries(originalEnvironment)) {
      if (value !== undefined) {
        process.env[key] = value;
      }
    }
  });

  it('does not call Secrets Manager when database variables already exist', async () => {
    process.env.POSTGRES_HOST = 'localhost';
    process.env.POSTGRES_PORT = '5432';
    process.env.POSTGRES_DB = 'postgres';
    process.env.POSTGRES_RUNTIME_USER = 'app';
    process.env.POSTGRES_RUNTIME_PASSWORD = 'password';

    const getSecret = jest.fn();

    await loadDatabaseSecretEnvironment(getSecret);

    expect(getSecret).not.toHaveBeenCalled();
  });

  it('loads database variables from the configured secret', async () => {
    process.env.DATABASE_SECRET_ARN = 'database-secret';

    const getSecret = jest.fn().mockResolvedValue(
      JSON.stringify({
        POSTGRES_HOST: 'pooler.example.com',
        POSTGRES_PORT: '6543',
        POSTGRES_DB: 'postgres',
        POSTGRES_RUNTIME_USER: 'runtime-user',
        POSTGRES_RUNTIME_PASSWORD: 'runtime-password',
        POSTGRES_SSL_MODE: 'require',
      }),
    );

    await loadDatabaseSecretEnvironment(getSecret);

    expect(getSecret).toHaveBeenCalledWith('database-secret');
    expect(process.env.POSTGRES_HOST).toBe('pooler.example.com');
    expect(process.env.POSTGRES_PORT).toBe('6543');
    expect(process.env.POSTGRES_RUNTIME_USER).toBe('runtime-user');
    expect(process.env.POSTGRES_SSL_MODE).toBe('require');
  });

  it('fails when neither environment variables nor a secret ARN exist', async () => {
    await expect(loadDatabaseSecretEnvironment(jest.fn())).rejects.toThrow(
      'DATABASE_SECRET_ARN is required',
    );
  });

  it('fails when the secret is missing a required field', async () => {
    process.env.DATABASE_SECRET_ARN = 'database-secret';

    const getSecret = jest.fn().mockResolvedValue(
      JSON.stringify({
        POSTGRES_HOST: 'pooler.example.com',
      }),
    );

    await expect(loadDatabaseSecretEnvironment(getSecret)).rejects.toThrow(
      'The database secret is missing POSTGRES_PORT',
    );
  });
});
