import { ConfigService } from '@nestjs/config';
import { createApp } from './create-app';

async function bootstrap() {
  const app = await createApp();
  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);

  await app.listen(port);
}

bootstrap().catch((error: unknown) => {
  console.error('Failed to start API', error);
  process.exit(1);
});
