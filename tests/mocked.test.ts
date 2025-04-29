import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { TBPlusSDK } from "../src";
import dotenv from "dotenv";
import { GatewayMode, PaymentMethod } from "../src/enums";

const API_KEY = "12345";
const API_SECRET = "12345";
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
  http.post(
    "https://api.tatrabanka.sk/tatrapayplus/production/auth/oauth/v2/token",
    () => {
      return HttpResponse.json({
        access_token: "d8fc6511-4e80-4972-9f91-604fcd06a6d7",
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
      API_KEY as string,
      API_SECRET as string,
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
      API_KEY as string,
      API_SECRET as string,
    );

    const statusList: { status: number; key: string | null }[] = [];
    server.use(
      http.patch(`${sdk.baseUrl}/v1/payments/123`, ({ request }) => {
        if (statusList.length == 3) {
          statusList.push({
            status: 200,
            key: request.headers.get("Idempotency-Key"),
          });
          return HttpResponse.json({}, { status: 200 });
        } else {
          statusList.push({
            status: 500,
            key: request.headers.get("Idempotency-Key"),
          });
          return HttpResponse.json({}, { status: 500 });
        }
      }),
    );
    const { error, response } = await sdk.updatePayment("123", {
      amount: 100,
      operationType: "CHARGEBACK",
    });
    expect(error).toBeFalsy();
    expect(response.status).toBe(200);
    expect(statusList.map((item) => item.status)).toStrictEqual([
      500, 500, 500, 200,
    ]);
    expect(
      new Set(statusList.map((item) => item.key)).size,
      "Expect to retry have same idempotency key",
    ).toBe(1);
  });

  it("retrieve available payment methods", async () => {
    const sdk = new TBPlusSDK(
      API_KEY as string,
      API_SECRET as string,
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
      API_KEY as string,
      API_SECRET as string,
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

  it("test card sign", async () => {
    const sdk = new TBPlusSDK(
      API_KEY as string,
      API_SECRET as string,
    );
    const result = sdk.generateSignedCardIdFromCid("12345");
    expect(result).toBeTruthy();
  });

  it("test auth token and production mode", async () => {
    const sdkSandbox = new TBPlusSDK(
      API_KEY as string,
      API_SECRET as string,
    );
    const accessTokenSandbox = await sdkSandbox.fetchAccessToken();
    expect(accessTokenSandbox).toBe("e8fc6511-4e80-4972-9f91-604fcd06a6d7");

    const sdkProduction = new TBPlusSDK(
      API_KEY as string,
      API_SECRET as string,
      { mode: GatewayMode.PRODUCTION },
    );
    const accessTokenProduction = await sdkProduction.fetchAccessToken();
    expect(accessTokenProduction).toBe("d8fc6511-4e80-4972-9f91-604fcd06a6d7");

    expect(() => {
      new TBPlusSDK(API_KEY as string, API_SECRET as string,{
        mode: "live" as never,
      });
    }).toThrowError("Unknown gateway mode");
  });

  it("test create payment language and preferred method headers", async () => {
    const sdk = new TBPlusSDK(
      API_KEY as string,
      API_SECRET as string,
    );
    server.use(
      http.post(`${sdk.baseUrl}/v1/payments`, ({ request }) => {
        const newPayment = {
          paymentId: "f9ed1103-49ac-42e7-981c-6a70ffdf218c",
          tatraPayPlusUrl:
            "https://api.tatrabanka.sk/tatrapayplus/sandbox/v1/auth?paymentId=f9ed1103-49ac-42e7-981c-6a70ffdf218c&client_id=l7ba7ffa0bf66b49b88d17dfe144955f54&hmac=33b24479a44eaf8449a9ee89ff6f39969c0137c5512eaefee57f87350c8ae730",
          availablePaymentMethods: [
            {
              isAvailable: true,
              paymentMethod: "CARD_PAY",
            },
            {
              isAvailable: true,
              paymentMethod: "PAY_LATER",
            },
            {
              isAvailable: true,
              paymentMethod: "BANK_TRANSFER",
            },
            {
              isAvailable: true,
              paymentMethod: "QR_PAY",
            },
          ],
        };
        const headers: Record<string, string> = {};

        const acceptLanguage = request.headers.get("Accept-Language");
        if (acceptLanguage) headers["Accept-Language"] = acceptLanguage;

        const preferredMethod = request.headers.get("Preferred-Method");
        if (preferredMethod) headers["Preferred-Method"] = preferredMethod;

        const redirectUri = request.headers.get("Redirect-URI");
        if (redirectUri) headers["Redirect-URI"] = redirectUri;

        return HttpResponse.json(newPayment, {
          status: 200,
          headers,
        });
      }),
    );
    const REDIRECT_URI = "http://google.com";
    const { response, error } = await sdk.createPayment(
      {
        bankTransfer: {},
        basePayment: {
          endToEnd: "test",
          instructedAmount: {
            amountValue: 10,
            currency: "EUR",
          },
        },
      },
      REDIRECT_URI,
      "127.0.0.1",
      "en",
      "BANK_TRANSFER",
    );
    expect(error).toBeFalsy();
    expect(response.headers.get("Accept-Language")).toBe("en");
    expect(response.headers.get("Preferred-Method")).toBe("BANK_TRANSFER");
    expect(response.headers.get("Redirect-URI")).toBe(REDIRECT_URI);
  });

  it("test set appearances", async () => {
    const sdk = new TBPlusSDK(
      API_KEY as string,
      API_SECRET as string,
    );
    server.use(
      http.post(`${sdk.baseUrl}/v1/appearances`, () => {
        return HttpResponse.json(
          {},
          {
            status: 201,
          },
        );
      }),
    );
    const { response, error } = await sdk.setAppearances({
      theme: "SYSTEM",
      surfaceAccent: {
        colorDarkMode: "#fff",
        colorLightMode: "#fff",
      },
      tintAccent: {
        colorDarkMode: "#fff",
        colorLightMode: "#fff",
      },
      tintOnAccent: {
        colorDarkMode: "#fff",
        colorLightMode: "#fff",
      },
    });
    expect(error).toBeFalsy();
    expect(response.status).toBe(201);
  });

  it("test set logo", async () => {
    const sdk = new TBPlusSDK(
      API_KEY as string,
      API_SECRET as string,
    );
    server.use(
      http.post(`${sdk.baseUrl}/v1/appearances/logo`, () => {
        return HttpResponse.json(
          {},
          {
            status: 201,
          },
        );
      }),
    );
    const { response, error } = await sdk.setAppearancesLogo({
      logoImage:
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAIAQMAAAD+wSzIAAAABlBMVEX///+/v7+jQ3Y5AAAADklEQVQI12P4AIX8EAgALgAD/aNpbtEAAAAASUVORK5CYII",
    });
    expect(error).toBeFalsy();
    expect(response.status).toBe(201);
  });

  it("unable to retrieve access token", async () => {
    const sdk = new TBPlusSDK(
      API_KEY as string,
      API_SECRET as string,
    );
    server.use(
      http.post(`${sdk.baseUrl}/auth/oauth/v2/token`, () => {
        return HttpResponse.json({}, { status: 404 });
      }),
    );
    await expect(
      sdk.setAppearancesLogo({
        logoImage:
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAIAQMAAAD+wSzIAAAABlBMVEX///+/v7+jQ3Y5AAAADklEQVQI12P4AIX8EAgALgAD/aNpbtEAAAAASUVORK5CYII",
      }),
    ).rejects.toThrowError("Unable to retrieve access token: undefined");
  });

  it("direct payment create", async () => {
    const sdk = new TBPlusSDK(
      API_KEY as string,
      API_SECRET as string,
    );
    const REDIRECT_URI = "http://google.com";
    server.use(
      http.post(`${sdk.baseUrl}/v1/payments-direct`, () => {
        return HttpResponse.json(
          {
            paymentId: "f9ed1103-49ac-42e7-981c-6a70ffdf218c",
          },
          { status: 200 },
        );
      }),
    );
    const { error, response } = await sdk.createPaymentDirect(
      {
        amount: {
          amountValue: 30,
          currency: "EUR",
        },
        endToEnd: {
          variableSymbol: "123456",
          specificSymbol: "0244763",
          constantSymbol: "389",
        },
        isPreAuthorization: true,
        tdsData: {
          cardHolder: " U5t4K7WgIgzxf9rgxt5@g4E54LhLOf@fJ",
          email: "user@example.com",
          phone: "+20912900552",
          billingAddress: {
            streetName: "Testerská",
            buildingNumber: "35",
            townName: "Bratislava",
            postCode: "85104",
            country: "SK",
          },
          shippingAddress: {
            streetName: "Testerská",
            buildingNumber: "35",
            townName: "Bratislava",
            postCode: "85104",
            country: "SK",
          },
        },
        ipspData: {
          subMerchantId: "5846864684",
          name: "CI1uskknSOUXs4@mJ",
          location: "96A6Mrz",
          country: "SE",
        },
        token: {
          token: {
            header: {
              ephemeralPublicKey:
                "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAELAfD ie0Ie1TxCcrFt69BzcQ52+F+Fhm5mDw6pMR54AzoFMgdGPRbqoLtFpoSe0FI/m0cqRMOVM2W4Bz9jVZZHA==",
              publicKeyHash: "LjAAyv6vb6jOEkjfG7L1a5OR2uCTHIkB61DaYdEWD",
              transactionId:
                "0c4352c073ad460044517596dbbf8fe503a837138c8c2de18fddb37ca3ec5295",
            },
            data: "M8i9PNK4yXtKO3xmOn6uyYOWmQ+iX9/Oc0EWHJZnPZ/IAEe2UYNCfely3dgq3veEygmQcl0s8lvMeCIZAbbBvbZW...",
            signature: "bNEa18hOrgG/oFk/o0CtYR01vhm+34RbStas1T+tkFLpP0eG5A+...",
            version: "EC_v1",
          },
        },
      },
      REDIRECT_URI,
      "127.0.0.1",
    );
    expect(error).toBeFalsy();
    expect(response.status).toBe(200);
  });
});
