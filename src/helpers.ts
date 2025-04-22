import { components } from "./paths";
import { PaymentStatuses } from "./types";
import { PaymentMethod, SimpleStatus } from "./enums";
import creditCardType from "credit-card-type";

export function removeDiacritics(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^0-9a-zA-Z.@_ -]/g, "");
}

export function trimAndRemoveSpecialCharacters(str: string): string {
  str = str.replace(/[<>|`\\]/g, " ").trim();
  return str;
}

export function removeSpecialCharactersFromStrings<T>(obj: T): T {
  if (typeof obj === "string") {
    return trimAndRemoveSpecialCharacters(obj) as T;
  } else if (Array.isArray(obj)) {
    return obj.map((item) => removeSpecialCharactersFromStrings(item)) as T;
  } else if (typeof obj === "object" && obj !== null) {
    return Object.fromEntries(
      Object.entries(obj).map(([key, value]) => [
        key,
        removeSpecialCharactersFromStrings(value),
      ]),
    ) as T;
  }
  return obj;
}

export function getAvailable(
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

export function getSimpleStatus(
  paymentStatus: components["schemas"]["paymentIntentStatusResponse"],
) {
  if (!paymentStatus.selectedPaymentMethod || !paymentStatus.status) {
    return SimpleStatus.PENDING;
  }
  let plainStatus;
  if (typeof paymentStatus.status === "string") {
    plainStatus = paymentStatus.status;
  } else if (typeof paymentStatus.status === "object") {
    plainStatus = paymentStatus.status.status;
  } else {
    return SimpleStatus.PENDING;
  }

  if (
    paymentMethodStatuses[
      paymentStatus.selectedPaymentMethod
    ]?.authorized.includes(plainStatus)
  ) {
    return SimpleStatus.AUTHORIZED;
  }

  if (
    paymentMethodStatuses[
      paymentStatus.selectedPaymentMethod
    ]?.capture.includes(plainStatus)
  ) {
    return SimpleStatus.CAPTURE;
  }

  if (
    paymentMethodStatuses[
      paymentStatus.selectedPaymentMethod
    ]?.rejected.includes(plainStatus)
  ) {
    return SimpleStatus.REJECTED;
  }
  return SimpleStatus.PENDING;
}

export function getSavedCardData(
  paymentStatus: components["schemas"]["paymentIntentStatusResponse"],
) {
  let savedCardData;
  const isCardPayment =
    paymentStatus.selectedPaymentMethod == PaymentMethod.CARD_PAY;
  if (!isCardPayment || typeof paymentStatus.status !== "object") {
    return savedCardData;
  }
  if (
    paymentStatus.status.comfortPay?.cid &&
    paymentStatus.status.comfortPay.status == "OK"
  ) {
    let resultCreditCard;
    if (paymentStatus.status.maskedCardNumber) {
      resultCreditCard = creditCardType(
        paymentStatus.status.maskedCardNumber.substring(0, 4),
      )[0];
    }

    savedCardData = {
      cid: paymentStatus.status.comfortPay.cid,
      maskedCardNumber: paymentStatus.status.maskedCardNumber,
      creditCard: resultCreditCard,
    };
  }
  return savedCardData;
}

export const paymentMethodStatuses: Record<PaymentMethod, PaymentStatuses> = {
  [PaymentMethod.QR_PAY]: {
    capture: ["ACSC", "ACCC"],
    rejected: ["CANC", "RJCT"],
    authorized: [],
  },
  [PaymentMethod.BANK_TRANSFER]: {
    capture: ["ACSC", "ACCC"],
    rejected: ["CANC", "RJCT"],
    authorized: [],
  },
  [PaymentMethod.PAY_LATER]: {
    capture: ["LOAN_APPLICATION_FINISHED", "LOAN_DISBURSED"],
    rejected: ["CANCEL", "EXPIRED"],
    authorized: [],
  },
  [PaymentMethod.CARD_PAY]: {
    capture: ["OK", "CB"],
    rejected: ["FAIL"],
    authorized: ["PA"],
  },
  [PaymentMethod.DIRECT_API]: {
    capture: ["OK", "CB"],
    rejected: ["FAIL"],
    authorized: [],
  },
};
