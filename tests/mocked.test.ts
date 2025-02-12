import { describe, expect, it, beforeAll, afterAll, afterEach } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { TBPlusSDK } from "../src";
import dotenv from "dotenv";

dotenv.config();
const server = setupServer();

beforeAll(() => {
  server.listen({
    onUnhandledRequest: (request) => {
      throw new Error(
        `No request handler found for ${request.method} ${request.url}`,
      );
    },
  });
});

afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("TBPlusSDK Mocked suit", () => {
  it("test retry failed after 3 retries", async () => {
    const sdk = new TBPlusSDK(
      process.env.API_KEY as string,
      process.env.API_SECRET as string,
    );
    server.use(
      http.get(`${sdk.baseUrl}/v1/payments/methods`, () =>
        HttpResponse.json({}, { status: 500 }),
      ),
    );
    sdk.UNPROTECTED_ROUTES.push("/v1/payments/methods");
    const { error, response } = await sdk.getPaymentMethods();
    expect(error).toBeTruthy();
    expect(response.status).toBe(500);
  });

  it("test retry success on last retry", async () => {
    const sdk = new TBPlusSDK(
      process.env.API_KEY as string,
      process.env.API_SECRET as string,
    );
    let attempt = 0;
    server.use(
      http.get(`${sdk.baseUrl}/v1/payments/methods`, () => {
        attempt += 1;
        if (attempt == 4) {
          return HttpResponse.json({}, { status: 200 });
        } else {
          return HttpResponse.json({}, { status: 500 });
        }
      }),
    );
    sdk.UNPROTECTED_ROUTES.push("/v1/payments/methods");
    const { error, response } = await sdk.getPaymentMethods();
    expect(error).toBeFalsy();
    expect(response.status).toBe(200);
  });
});
