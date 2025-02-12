import { describe, expect, it, vitest } from "vitest";
import { TBPlusSDK } from "../src";
import dotenv from "dotenv";
import exp = require("node:constants");
import { components } from "../src/paths";
import { PaymentMethod } from "../src/enums";

dotenv.config();

function getAvailable(
  paymentMethods: components["schemas"]["availablePaymentMethod"][] | undefined,
) {
  if (!paymentMethods) {
    return [];
  }
  return paymentMethods
    .filter((item) => item.isAvailable)
    .map((item) => item.paymentMethod)
    .sort();
}

describe("TBPlusSDK", () => {
  it("retrieve available payment methods", async () => {
    const sdk = new TBPlusSDK(
      process.env.API_KEY as string,
      process.env.API_SECRET as string,
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
      "https://google.com",
    );
    expect(error).toBeUndefined();
    if (data) {
      expect(data.paymentId).toBeTruthy();
      expect(data.tatraPayPlusUrl).toBeTruthy();
      expect(getAvailable(data.availablePaymentMethods)).toStrictEqual(
        [PaymentMethod.BANK_TRANSFER, PaymentMethod.QR_PAY].sort(),
      );
    }
  });

  it("create all possible payment", async () => {
    const sdk = new TBPlusSDK(
      process.env.API_KEY as string,
      process.env.API_SECRET as string,
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
      "https://google.com",
    );
    expect(error).toBeUndefined();
    if (data) {
      expect(data.paymentId).toBeTruthy();
      expect(data.tatraPayPlusUrl).toBeTruthy();
      console.log(data.availablePaymentMethods);
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
});
