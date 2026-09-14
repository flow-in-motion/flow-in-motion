import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'staging', 'production')
    .default('development'),
  PORT: Joi.number().integer().positive().default(3000),
  PAGE_SIZE: Joi.number().integer().positive().default(20),
  LOG_LEVEL: Joi.string()
    .valid('fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent')
    .default('info'),
  APP_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .required(),

  POSTGRES_HOST: Joi.string().required(),
  POSTGRES_PORT: Joi.number().integer().positive().default(5432),
  POSTGRES_DB: Joi.string().required(),
  POSTGRES_SSL: Joi.boolean().truthy('true').falsy('false').default(false),
  POSTGRES_MIGRATION_USER: Joi.string().required(),
  POSTGRES_MIGRATION_PASSWORD: Joi.string().required(),
  POSTGRES_RUNTIME_USER: Joi.string().required(),
  POSTGRES_RUNTIME_PASSWORD: Joi.string().required(),

  MINIO_ENDPOINT: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .required(),

  COGNITO_REGION: Joi.string().required(),
  COGNITO_USER_POOL_ID: Joi.string().required(),
  COGNITO_CLIENT_ID: Joi.string().required(),
  COGNITO_DOMAIN: Joi.string().hostname().required(),

  INVITATION_TOKEN_TTL_HOURS: Joi.number().integer().positive().default(72),
  INVITATION_TOKEN_BYTES: Joi.number().integer().min(32).default(32),
  INVITATION_EMAIL_FROM: Joi.string().email().optional(),
  INVITATION_EMAIL_REGION: Joi.string().optional(),
  FEEDBACK_EMAIL_TO: Joi.string().email().allow('').optional(),
});
