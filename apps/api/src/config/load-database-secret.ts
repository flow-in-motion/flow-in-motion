import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager';

const DATABASE_ENV_KEYS = [
  'POSTGRES_HOST',
  'POSTGRES_PORT',
  'POSTGRES_DB',
  'POSTGRES_RUNTIME_USER',
  'POSTGRES_RUNTIME_PASSWORD',
] as const;

type FetchSecret = (secretId: string) => Promise<string | undefined>;

const secretsManager = new SecretsManagerClient({});

async function fetchSecret(secretId: string): Promise<string | undefined> {
  const result = await secretsManager.send(
    new GetSecretValueCommand({
      SecretId: secretId,
    }),
  );

  return result.SecretString;
}

function hasDatabaseEnvironment(): boolean {
  return DATABASE_ENV_KEYS.every((key) => Boolean(process.env[key]));
}

export async function loadDatabaseSecretEnvironment(
  getSecret: FetchSecret = fetchSecret,
): Promise<void> {
  if (hasDatabaseEnvironment()) {
    return;
  }

  const secretId = process.env.DATABASE_SECRET_ARN;

  if (!secretId) {
    throw new Error(
      'DATABASE_SECRET_ARN is required when database environment variables are absent',
    );
  }

  const secretString = await getSecret(secretId);

  if (!secretString) {
    throw new Error('The database secret does not contain SecretString data');
  }

  let secret: unknown;

  try {
    secret = JSON.parse(secretString);
  } catch {
    throw new Error('The database secret must contain valid JSON');
  }

  if (!secret || typeof secret !== 'object' || Array.isArray(secret)) {
    throw new Error('The database secret must contain a JSON object');
  }

  const values = secret as Record<string, unknown>;

  for (const key of DATABASE_ENV_KEYS) {
    const value = values[key];

    if (typeof value !== 'string' || value.length === 0) {
      throw new Error(`The database secret is missing ${key}`);
    }

    process.env[key] = value;
  }

  const sslMode = values.POSTGRES_SSL_MODE;

  if (typeof sslMode === 'string' && sslMode.length > 0) {
    process.env.POSTGRES_SSL_MODE = sslMode;
  }
}
