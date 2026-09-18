import serverlessExpress from '@codegenie/serverless-express';
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
  Callback,
  Context,
} from 'aws-lambda';
import type { RequestListener } from 'node:http';
import { createApp } from './create-app';

type LambdaHandler = (
  event: APIGatewayProxyEventV2,
  context: Context,
  callback: Callback<APIGatewayProxyResultV2>,
) => Promise<APIGatewayProxyResultV2>;

let serverPromise: Promise<LambdaHandler> | undefined;

async function bootstrapLambda(): Promise<LambdaHandler> {
  const app = await createApp();

  // Initialize Nest without opening a permanent TCP listener.
  await app.init();

  const httpAdapterInstance: unknown = app.getHttpAdapter().getInstance();

  if (typeof httpAdapterInstance !== 'function') {
    throw new Error('Expected the Nest HTTP adapter to expose an Express app');
  }

  const expressApp = httpAdapterInstance as RequestListener;

  const server = serverlessExpress<
    APIGatewayProxyEventV2,
    APIGatewayProxyResultV2
  >({ app: expressApp });

  // The adapter defaults to promise resolution, while its public Handler type
  // also includes callback-style void responses.
  return server as LambdaHandler;
}

function getServer(): Promise<LambdaHandler> {
  serverPromise ??= bootstrapLambda();
  return serverPromise;
}

export const handler: LambdaHandler = async (event, context, callback) => {
  // Allow Lambda to return while retaining the PostgreSQL pool for reuse.
  context.callbackWaitsForEmptyEventLoop = false;

  const server = await getServer();
  return server(event, context, callback);
};
