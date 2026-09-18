import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'staging', 'production')
    .default('development'),
  ENABLE_SCHEDULER: Joi.boolean().default(true),
  PORT: Joi.number().integer().positive().default(3000),
  PAGE_SIZE: Joi.number().integer().positive().default(20),
  LOG_LEVEL: Joi.string()
    .valid('fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent')
    .default('info'),
  APP_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .required(),

  POSTGRES_HOST: Joi.string().required(),
  POSTGRES_PORT: Joi.number().integer().positive().required(),
  POSTGRES_DB: Joi.string().required(),
  POSTGRES_SSL_MODE: Joi.string()
    .valid('disable', 'require', 'verify-full')
    .default('require'),
  POSTGRES_SSL_CA: Joi.string().when('POSTGRES_SSL_MODE', {
    is: 'verify-full',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  POSTGRES_CONNECT_TIMEOUT_MS: Joi.number()
    .integer()
    .min(100)
    .max(30_000)
    .default(5_000),
  POSTGRES_QUERY_TIMEOUT_MS: Joi.number()
    .integer()
    .min(100)
    .max(60_000)
    .default(10_000),
  POSTGRES_IDLE_TIMEOUT_MS: Joi.number()
    .integer()
    .min(100)
    .max(60_000)
    .default(10_000),
  // Allowed for local bootstrap and deployment migrations, but deliberately
  // not required by the running API/Lambda environment.
  POSTGRES_USER: Joi.string().optional(),
  POSTGRES_PASSWORD: Joi.string().optional(),
  POSTGRES_MIGRATION_HOST: Joi.string().optional(),
  POSTGRES_MIGRATION_PORT: Joi.number().integer().positive().optional(),
  POSTGRES_MIGRATION_SSL_MODE: Joi.string()
    .valid('disable', 'require', 'verify-full')
    .optional(),
  POSTGRES_MIGRATION_SSL_CA: Joi.string().optional(),
  POSTGRES_MIGRATION_USER: Joi.string().optional(),
  POSTGRES_MIGRATION_PASSWORD: Joi.string().optional(),
  POSTGRES_RUNTIME_USER: Joi.string().required(),
  POSTGRES_RUNTIME_PASSWORD: Joi.string().required(),

  SUPABASE_URL: Joi.string()
    .uri({ scheme: ['https'] })
    .required(),
  SUPABASE_JWT_AUDIENCE: Joi.string().default('authenticated'),

  INVITATION_TOKEN_TTL_HOURS: Joi.number().integer().positive().default(72),
  INVITATION_TOKEN_BYTES: Joi.number().integer().min(32).default(32),
  INVITATION_EMAIL_FROM: Joi.string().email().optional(),
  INVITATION_EMAIL_REGION: Joi.string().optional(),
  AWS_REGION: Joi.string().default('ap-southeast-2'),
  FEEDBACK_EMAIL_TO: Joi.string().email().allow('').optional(),
}).custom((value: Record<string, unknown>, helpers) => {
  if (
    (value.NODE_ENV === 'production' || value.NODE_ENV === 'staging') &&
    value.POSTGRES_SSL_MODE === 'disable'
  ) {
    return helpers.error('any.invalid');
  }

  if (value.NODE_ENV === 'production' && value.POSTGRES_PORT !== 6543) {
    return helpers.error('any.invalid');
  }

  return value;
});
