// Boots the bundled Lambda in an empty folder (so nothing can be borrowed
// from a nearby node_modules) and sends it a few requests. Fails the build
// if the bundle can't start or answer correctly.
//
// Usage: node apps/api/scripts/smoke-lambda-bundle.mjs <bundle-dir>
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const bundleDir = resolve(process.argv[2] ?? '');
const workDir = mkdtempSync(join(tmpdir(), 'lambda-smoke-'));

try {
  for (const file of ['lambda.js', 'cleanup-lambda.js']) {
    copyFileSync(join(bundleDir, file), join(workDir, file));
  }

  // Dummy configuration: enough to pass start-up validation. Nothing here
  // connects to a real database or Supabase.
  Object.assign(process.env, {
    NODE_ENV: 'production',
    LOG_LEVEL: 'error',
    APP_URL: 'https://app.example.org',
    POSTGRES_HOST: '127.0.0.1',
    POSTGRES_PORT: '6543',
    POSTGRES_DB: 'smoke',
    POSTGRES_SSL_MODE: 'require',
    POSTGRES_RUNTIME_USER: 'smoke',
    POSTGRES_RUNTIME_PASSWORD: 'smoke',
    SUPABASE_URL: 'https://smoke.invalid',
    SUPABASE_JWT_AUDIENCE: 'authenticated',
    AWS_REGION: 'ap-southeast-2',
  });

  const require = createRequire(join(workDir, 'index.js'));
  const { handler } = require(join(workDir, 'lambda.js'));
  const cleanup = require(join(workDir, 'cleanup-lambda.js'));

  const request = (path, headers = {}) =>
    handler(
      {
        version: '2.0',
        routeKey: '$default',
        rawPath: path,
        rawQueryString: '',
        headers: { host: 'api.smoke', ...headers },
        requestContext: {
          http: { method: 'GET', path, sourceIp: '127.0.0.1', protocol: 'HTTP/1.1', userAgent: 'smoke' },
          requestId: 'smoke',
          stage: '$default',
          timeEpoch: Date.now(),
        },
        isBase64Encoded: false,
      },
      {},
    );

  const started = performance.now();
  const checks = [
    ['GET /health/live', await request('/health/live'), 200],
    ['GET /api/v1/me without a token', await request('/api/v1/me'), 401],
    [
      'GET /api/v1/me with an invalid token',
      await request('/api/v1/me', { authorization: 'Bearer invalid' }),
      401,
    ],
  ];
  const elapsed = Math.round(performance.now() - started);

  let failed = typeof cleanup.handler !== 'function';
  if (failed) console.error('cleanup-lambda.js does not export a handler');
  for (const [name, response, expected] of checks) {
    const ok = response?.statusCode === expected;
    failed ||= !ok;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} -> ${response?.statusCode} (expected ${expected})`);
  }
  console.log(`Bundled API started and answered in ${elapsed} ms`);
  process.exitCode = failed ? 1 : 0;
} finally {
  rmSync(workDir, { recursive: true, force: true });
}
// The API keeps timers alive (e.g. the database pool), so exit explicitly.
process.exit(process.exitCode ?? 0);
