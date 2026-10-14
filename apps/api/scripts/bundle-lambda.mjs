// Bundles the compiled API (dist/) into one self-contained file per Lambda
// handler, so a cold start loads a single file instead of thousands of files
// from node_modules.
//
// Usage: node apps/api/scripts/bundle-lambda.mjs <compiled-dist-dir> <out-dir>
//
// Bundling the tsc output (rather than the TypeScript source) keeps the
// decorator metadata NestJS needs for dependency injection.
import { build } from 'esbuild';
import { resolve } from 'node:path';

const [distDir, outDir] = process.argv.slice(2);
if (!distDir || !outDir) {
  console.error('Usage: bundle-lambda.mjs <compiled-dist-dir> <out-dir>');
  process.exit(1);
}

const result = await build({
  entryPoints: {
    lambda: resolve(distDir, 'lambda.js'),
    'cleanup-lambda': resolve(distDir, 'cleanup-lambda.js'),
  },
  outdir: outDir,
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  // Not minified, so stack traces in CloudWatch stay readable. Minifying
  // didn't make start-up measurably faster.
  minify: false,
  // NestJS resolves providers by class name.
  keepNames: true,
  metafile: true,
  logLevel: 'warning',
  // Optional integrations NestJS and @nestjs/terminus try to load only if
  // installed. This API uses none of them.
  external: [
    '@nestjs/microservices',
    '@nestjs/microservices/*',
    '@nestjs/websockets',
    '@nestjs/websockets/*',
    '@nestjs/platform-socket.io',
    '@fastify/*',
    'class-transformer/storage',
    'cache-manager',
    'pg-native',
    '@mikro-orm/core',
    '@nestjs/mongoose',
    '@nestjs/sequelize',
    '@nestjs/sequelize/*',
    '@nestjs/typeorm',
    '@nestjs/typeorm/*',
    'mongoose',
    'typeorm',
    'sequelize',
    '@prisma/client',
  ],
});

for (const [file, output] of Object.entries(result.metafile.outputs)) {
  console.log(`${file}  ${(output.bytes / 1024 / 1024).toFixed(1)} MB`);
}
