import { describe, expect, it, beforeAll, afterAll, afterEach } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { TBPlusSDK } from "../src";
import dotenv from "dotenv";
import { PaymentMethod } from "../src/enums";

dotenv.config();
const server = setupServer(
  http.post(
    "https://api.tatrabanka.sk/tatrapayplus/sandbox/auth/oauth/v2/token",
    () => {
      return HttpResponse.json({
        access_token: "e8fc6511-4e80-4972-9f91-604fcd06a6d7",
        token_type: "Bearer",
        expires_in: 86400,
        scope: "TATRAPAYPLUS",
      });
    },
  ),
);

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

const paymentMethodsSandboxResponse = {
  paymentMethods: [
    {
      supportedCurrency: ["EUR"],
      paymentMethod: "BANK_TRANSFER",
      allowedBankProviders: [
        {
          providerCode: "SLSP",
          countryCode: "SK",
          swiftCode: "GIBASKBXXXX",
          providerName: "Slovenská sporiteľňa",
        },
        {
          providerCode: "CSOB-SK",
          countryCode: "SK",
          swiftCode: "CEKOSKBXXXX",
          providerName: "ČSOB SK",
        },
        {
          providerCode: "TBSK",
          countryCode: "SK",
          swiftCode: "TATRSKBXXXX",
          providerName: "Tatra banka",
        },
      ],
    },
    {
      amountRangeRule: {
        minAmount: 100.0,
        maxAmount: 30000.0,
      },
      supportedCurrency: ["EUR"],
      paymentMethod: "PAY_LATER",
    },
    {
      supportedCurrency: ["EUR", "USD"],
      paymentMethod: "DIRECT_API",
    },
    {
      supportedCurrency: ["EUR", "USD"],
      paymentMethod: "CARD_PAY",
    },
    {
      supportedCurrency: ["EUR"],
      paymentMethod: "QR_PAY",
      supportedCountry: ["SK", "CZ"],
    },
  ],
};

describe("TBPlusSDK Mocked suit", () => {
  it("test retry failed after 3 retries", async () => {
    const sdk = new TBPlusSDK(
      process.env.API_KEY as string,
      process.env.API_SECRET as string,
      "192.0.2.123",
    );
    server.use(
      http.get(`${sdk.baseUrl}/v1/payments/methods`, () =>
        HttpResponse.json({}, { status: 500 }),
      ),
    );
    const { error, response } = await sdk.getPaymentMethods();
    expect(error).toBeTruthy();
    expect(response.status).toBe(500);
  });

  it("test retry success on last retry", async () => {
    const sdk = new TBPlusSDK(
      process.env.API_KEY as string,
      process.env.API_SECRET as string,
      "192.0.2.123",
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

  it("retrieve available payment methods", async () => {
    const sdk = new TBPlusSDK(
      process.env.API_KEY as string,
      process.env.API_SECRET as string,
      "192.0.2.123",
    );
    server.use(
      http.get(`${sdk.baseUrl}/v1/payments/methods`, () => {
        return HttpResponse.json(paymentMethodsSandboxResponse, {
          status: 200,
        });
      }),
    );
    const { data: data_1 } = await sdk.getAvailablePaymentMethods({
      currencyCode: "USD",
    });
    expect(data_1?.map((item) => item.paymentMethod).sort()).toStrictEqual(
      [PaymentMethod.DIRECT_API, PaymentMethod.CARD_PAY].sort(),
    );

    const { data: data_2 } = await sdk.getAvailablePaymentMethods({
      totalAmount: 20,
    });
    expect(data_2?.map((item) => item.paymentMethod).sort()).toStrictEqual(
      [
        PaymentMethod.DIRECT_API,
        PaymentMethod.CARD_PAY,
        PaymentMethod.QR_PAY,
        PaymentMethod.BANK_TRANSFER,
      ].sort(),
    );

    const { data: data_3 } = await sdk.getAvailablePaymentMethods({
      totalAmount: 200,
    });
    expect(data_3?.map((item) => item.paymentMethod).sort()).toStrictEqual(
      [
        PaymentMethod.DIRECT_API,
        PaymentMethod.CARD_PAY,
        PaymentMethod.PAY_LATER,
        PaymentMethod.QR_PAY,
        PaymentMethod.BANK_TRANSFER,
      ].sort(),
    );

    const { data: data_4 } = await sdk.getAvailablePaymentMethods({
      totalAmount: 32000,
    });
    expect(data_4?.map((item) => item.paymentMethod).sort()).toStrictEqual(
      [
        PaymentMethod.DIRECT_API,
        PaymentMethod.CARD_PAY,
        PaymentMethod.QR_PAY,
        PaymentMethod.BANK_TRANSFER,
      ].sort(),
    );

    const { data: data_5 } = await sdk.getAvailablePaymentMethods({
      countryCode: "HU",
    });
    expect(data_5?.map((item) => item.paymentMethod).sort()).toStrictEqual(
      [
        PaymentMethod.DIRECT_API,
        PaymentMethod.CARD_PAY,
        PaymentMethod.PAY_LATER,
        PaymentMethod.BANK_TRANSFER,
      ].sort(),
    );

    const { data: data_6 } = await sdk.getAvailablePaymentMethods();
    expect(data_6?.map((item) => item.paymentMethod).sort()).toStrictEqual(
      [
        PaymentMethod.DIRECT_API,
        PaymentMethod.CARD_PAY,
        PaymentMethod.PAY_LATER,
        PaymentMethod.QR_PAY,
        PaymentMethod.BANK_TRANSFER,
      ].sort(),
    );

    const { data: data_7 } = await sdk.getAvailablePaymentMethods({
      countryCode: "HU",
      totalAmount: 50,
      currencyCode: "USD",
    });
    expect(data_7?.map((item) => item.paymentMethod).sort()).toStrictEqual(
      [PaymentMethod.DIRECT_API, PaymentMethod.CARD_PAY].sort(),
    );
  });

  it("test save card", async () => {
    const sdk = new TBPlusSDK(
      process.env.API_KEY as string,
      process.env.API_SECRET as string,
      "192.0.2.123",
    );
    server.use(
      http.get(
        `${sdk.baseUrl}/v1/payments/673e6841-5f70-4fd2-8b35-482be6da436e/status`,
        () => {
          const getPaymentStatusResponse = {
            selectedPaymentMethod: "CARD_PAY",
            authorizationStatus: "AUTH_DONE",
            status: {
              amount: 200,
              comfortPay: {
                status: "OK",
                cid: "123456789",
              },
              currency: "EUR",
              maskedCardNumber: "440577******5558",
              status: "OK",
            },
          };
          return HttpResponse.json(getPaymentStatusResponse, {
            status: 200,
          });
        },
      ),
      http.get(
        `${sdk.baseUrl}/v1/payments/173e6841-5f70-4fd2-8b35-482be6da436e/status`,
        () => {
          const getPaymentStatusResponse = {
            selectedPaymentMethod: "CARD_PAY",
            authorizationStatus: "AUTH_DONE",
            status: {
              amount: 200,
              comfortPay: {
                status: "OK",
                cid: "123456789",
              },
              currency: "EUR",
              maskedCardNumber: "512345******0008",
              status: "OK",
            },
          };
          return HttpResponse.json(getPaymentStatusResponse, {
            status: 200,
          });
        },
      ),
      http.get(
        `${sdk.baseUrl}/v1/payments/273e6841-5f70-4fd2-8b35-482be6da436e/status`,
        () => {
          const getPaymentStatusResponse = {
            selectedPaymentMethod: "CARD_PAY",
            authorizationStatus: "PAY_METHOD_SELECTED",
          };
          return HttpResponse.json(getPaymentStatusResponse, {
            status: 200,
          });
        },
      ),
      http.get(
        `${sdk.baseUrl}/v1/payments/373e6841-5f70-4fd2-8b35-482be6da436e/status`,
        () => {
          const getPaymentStatusResponse = {
            selectedPaymentMethod: "BANK_TRANSFER",
            authorizationStatus: "AUTH_DONE",
            status: "ACCC",
          };
          return HttpResponse.json(getPaymentStatusResponse, {
            status: 200,
          });
        },
      ),
    );
    const { savedCard: savedCard_1 } = await sdk.getPaymentStatus(
      "673e6841-5f70-4fd2-8b35-482be6da436e",
    );
    expect(savedCard_1?.creditCard?.type).toBe("visa");

    const { savedCard: savedCard_2 } = await sdk.getPaymentStatus(
      "173e6841-5f70-4fd2-8b35-482be6da436e",
    );
    expect(savedCard_2?.creditCard?.type).toBe("mastercard");

    const { savedCard: savedCard_3 } = await sdk.getPaymentStatus(
      "273e6841-5f70-4fd2-8b35-482be6da436e",
    );
    expect(savedCard_3?.creditCard, "No card, If not finished").toBeUndefined();

    const { savedCard: savedCard_4 } = await sdk.getPaymentStatus(
      "373e6841-5f70-4fd2-8b35-482be6da436e",
    );
    expect(savedCard_4?.creditCard, "No card, If not CARD_PAY").toBeUndefined();
  });
});
