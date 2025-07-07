import { describe, expect, it, vi } from "vitest";
import { GatewayMode, TBPlusSDK, PaymentMethod, SimpleStatus } from "../src";
import dotenv from "dotenv";
import { getAvailable } from "../src/helpers";
import { TBPlusLogger } from "../src/logger";

dotenv.config();

const REDIRECT_URI = "https://tatrabanka.sk/";
export class TestLogger extends TBPlusLogger {
  protected writeLine(line: string): void {
    console.log("[TestLogger]", line);
  }
}
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
      {},
      new TestLogger(),
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
      "127.0.0.1",
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
    const { data, error } = await sdk.createPayment(
      body,
      REDIRECT_URI,
      "127.0.0.1",
    );
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

  it("direct payment create", async () => {
    const sdk = new TBPlusSDK(
      process.env.API_KEY as string,
      process.env.API_SECRET as string,
    );
    const REDIRECT_URI = "http://google.com";
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
          name: "ASDQWE",
          location: "96A6Mrz",
          country: "SE",
        },
        token: "ABC12345",
      },
      REDIRECT_URI,
      "127.0.0.1",
    );
    expect(error).toBeFalsy();
    expect(response.status).toBe(201);
  });

  it("precalculate loan", async () => {
    const sdk = new TBPlusSDK(
      process.env.API_KEY as string,
      process.env.API_SECRET as string,
      {mode: GatewayMode.PRODUCTION},
      new TestLogger(),
    );
    const { data, error } = await sdk.precalculateLoan(
      {
        paymentMethod: PaymentMethod.PAY_LATER,
        loanAmount: 250.45,
        capacityInfo: {
          monthlyIncome: 2000,
          monthlyExpenses: 800,
          numberOfChildren: 0,
        },
      },
      "127.0.0.1",
    );

    expect(error).toBeUndefined();
    if (!data) {
      throw new Error('data empty');
    }

    expect(data).toBeInstanceOf(Array);
    expect(data.length).toBeGreaterThan(0);
    for (const item of data) {
      expect(typeof item.mainPreference).toBe("boolean");
      expect(typeof item.preference).toBe("boolean");
      expect(typeof item.capacityValidity).toBe("boolean");
      expect(typeof item.loanInterestRate).toBe("number");
      expect(typeof item.installmentAmount).toBe("number");
      expect(typeof item.rpmn).toBe("number");
      expect(typeof item.totalAmount).toBe("number");
      expect(typeof item.loanFee).toBe("number");
    }
  });
});
