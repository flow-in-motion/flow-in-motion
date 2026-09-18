import type { APIGatewayProxyEventV2, Context } from 'aws-lambda';

const mockCreateApp = jest.fn();
const mockServerlessExpress = jest.fn();

jest.mock('./create-app', () => ({
  createApp: mockCreateApp,
}));

jest.mock('@codegenie/serverless-express', () => ({
  __esModule: true,
  default: mockServerlessExpress,
}));

// Load the handler only after its dependencies have been mocked.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { handler } = require('./lambda') as typeof import('./lambda');

describe('Lambda handler', () => {
  it('initializes Nest once and reuses it across warm invocations', async () => {
    const init = jest.fn().mockResolvedValue(undefined);
    const expressApp = jest.fn();
    const lambdaServer = jest.fn().mockResolvedValue({
      statusCode: 200,
      body: 'ok',
    });

    mockCreateApp.mockResolvedValue({
      init,
      getHttpAdapter: () => ({
        getInstance: () => expressApp,
      }),
    });

    mockServerlessExpress.mockReturnValue(lambdaServer);

    const event = {} as APIGatewayProxyEventV2;
    const context = {
      callbackWaitsForEmptyEventLoop: true,
    } as Context;

    await handler(event, context);
    await handler(event, context);

    expect(mockCreateApp).toHaveBeenCalledTimes(1);
    expect(init).toHaveBeenCalledTimes(1);
    expect(mockServerlessExpress).toHaveBeenCalledTimes(1);
    expect(lambdaServer).toHaveBeenCalledTimes(2);
    expect(context.callbackWaitsForEmptyEventLoop).toBe(false);
  });
});
