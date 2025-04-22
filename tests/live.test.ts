import { describe, expect, it, vi } from "vitest";
import { TBPlusSDK } from "../src";
import dotenv from "dotenv";
import { PaymentMethod, SimpleStatus } from "../src/enums";
import { getAvailable } from "../src/helpers";

dotenv.config();

const REDIRECT_URI = "https://tatrabanka.sk/";

describe("TBPlusSDK tests on live", () => {
  it("retrieve all payment methods", async () => {
    const sdk = new TBPlusSDK(
      process.env.API_KEY as string,
      process.env.API_SECRET as string,
      "192.0.2.123",
    );
    const { data, error } = await sdk.getPaymentMethods();
    expect(error).toBeUndefined();
    if (data) {
      expect(data).toHaveProperty("paymentMethods");
      // BANK, QR, CARD, DIRECT, PAY_LATER
      expect(data.paymentMethods.length).toBe(5);
    }
  });

  it("create minimal payment", async () => {
    const sdk = new TBPlusSDK(
      process.env.API_KEY as string,
      process.env.API_SECRET as string,
      "192.0.2.123",
    );
    const { data, error } = await sdk.createPayment(
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
    );
    expect(error).toBeUndefined();
    if (!data) {
      return;
    }
    const paymentId = data.paymentId;

    expect(data.paymentId).toBeTruthy();
    expect(data.tatraPayPlusUrl).toBeTruthy();
    expect(getAvailable(data.availablePaymentMethods)).toStrictEqual(
      [PaymentMethod.BANK_TRANSFER, PaymentMethod.QR_PAY].sort(),
    );

    const { simpleStatus, error: payment_status_error } =
      await sdk.getPaymentStatus(paymentId);

    expect(payment_status_error).toBeUndefined();
    if (data) {
      expect(simpleStatus).toBe(SimpleStatus.PENDING);
    }
  });

  it("create all possible payment", async () => {
    const sdk = new TBPlusSDK(
      process.env.API_KEY as string,
      process.env.API_SECRET as string,
      "192.0.2.123",
    );
    const { data, error } = await sdk.createPayment(
      {
        bankTransfer: {},
        payLater: {
          order: {
            orderNo: "132456",
            orderItems: [
              {
                itemDetail: {
                  itemDetailSK: {
                    itemName: "test",
                  },
                },
                quantity: 1,
                totalItemPrice: 10000,
              },
            ],
          },
        },
        userData: {
          firstName: "Jozko",
          lastName: "Hruska",
          phone: "+421911123456",
        },
        cardDetail: {
          cardHolder: "Jozko Hruska",
        },
        basePayment: {
          endToEnd: "test",
          instructedAmount: {
            amountValue: 10000,
            currency: "EUR",
          },
        },
      },
      REDIRECT_URI,
      "127.0.0.1"
    );
    expect(error).toBeUndefined();
    if (data) {
      expect(data.paymentId).toBeTruthy();
      expect(data.tatraPayPlusUrl).toBeTruthy();
      expect(getAvailable(data.availablePaymentMethods)).toStrictEqual(
        [
          PaymentMethod.BANK_TRANSFER,
          PaymentMethod.CARD_PAY,
          PaymentMethod.QR_PAY,
          PaymentMethod.PAY_LATER,
        ].sort(),
      );
    }
  });

  it("card holder with diacritics and special characters in data", async () => {
    const requestHistory: Request[] = [];

    const mockFetch = vi.fn(async (input: RequestInfo, init?: RequestInit) => {
      const request = new Request(input, init);
      requestHistory.push(request.clone());
      return fetch(request);
    });
    const sdk = new TBPlusSDK(
      process.env.API_KEY as string,
      process.env.API_SECRET as string,
      "192.0.2.123",
      {
        createClientParams: {
          fetch: mockFetch,
        },
      },
    );
    const body = {
      bankTransfer: {},
      payLater: {
        order: {
          orderNo: "132456",
          orderItems: [
            {
              itemDetail: {
                itemDetailSK: {
                  itemName: "test",
                },
              },
              quantity: 1,
              totalItemPrice: 10000,
            },
          ],
        },
      },
      userData: {
        firstName: "<Jožko>",
        lastName: "|Hruška\\`",
        phone: "+421911123456",
      },
      cardDetail: {
        cardHolder: "ľščťžýáíéäô Hruška",
      },
      basePayment: {
        endToEnd: "test",
        instructedAmount: {
          amountValue: 10000,
          currency: "EUR",
        },
      },
    };
    const { data, error } = await sdk.createPayment(body, REDIRECT_URI, "127.0.0.1");
    const requestBody = await requestHistory[1]?.json();

    expect(error).toBeUndefined();
    expect(requestBody.cardDetail.cardHolder).toBe("lsctzyaieao Hruska");
    expect(requestBody.userData.firstName).toBe("Jožko");
    expect(requestBody.userData.lastName).toBe("Hruška");
    if (!data) {
      return;
    }
    expect(getAvailable(data.availablePaymentMethods)).toStrictEqual(
      [
        PaymentMethod.BANK_TRANSFER,
        PaymentMethod.CARD_PAY,
        PaymentMethod.QR_PAY,
        PaymentMethod.PAY_LATER,
      ].sort(),
    );

    const { response, error: cancelErrors } = await sdk.cancelPayment(
      data.paymentId,
    );
    expect(cancelErrors).toBeUndefined();
    expect(response.status).toBe(200);

    const { response: response2, error: cancelErrors2 } =
      await sdk.cancelPayment(data.paymentId);
    expect(cancelErrors2).toBeTruthy();
    expect(response2.status).toBe(400);
  });
});
