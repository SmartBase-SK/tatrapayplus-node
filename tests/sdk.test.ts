import { describe, it, expect } from "vitest";
import { TBPlusSDK } from "../src";
import dotenv from "dotenv";

dotenv.config();

describe("TBPlusSDK", () => {
  it("should fetch available payment methods", async () => {
    const sdk = new TBPlusSDK(
      process.env.API_KEY as string,
      process.env.API_SECRET as string,
    );
    const paymentMethods = await sdk.getPaymentsMethods();
    expect(paymentMethods).toHaveProperty("paymentMethods");
  });
});
