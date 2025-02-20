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

export function limitLength(str: string, limit: number): string {
  str = str.length > limit ? str.substring(0, limit) : str;
  return str;
}

export function trimAndRemoveSpecialCharacters(str: string): string {
  str = str.replace(/[<>|`\\]/g, " ").trim();
  return str;
}

export function removeCharacterFromStrings<T>(obj: T): T {
  if (typeof obj === "string") {
    return trimAndRemoveSpecialCharacters(obj) as T;
  } else if (Array.isArray(obj)) {
    return obj.map((item) => removeCharacterFromStrings(item)) as T;
  } else if (typeof obj === "object" && obj !== null) {
    return Object.fromEntries(
      Object.entries(obj).map(([key, value]) => [
        key,
        removeCharacterFromStrings(value),
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
    ]?.accepted.includes(plainStatus)
  ) {
    return SimpleStatus.ACCEPTED;
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
    accepted: ["ACSC", "ACCC"],
    rejected: ["CANC", "RJCT"],
  },
  [PaymentMethod.BANK_TRANSFER]: {
    accepted: ["ACSC", "ACCC"],
    rejected: ["CANC", "RJCT"],
  },
  [PaymentMethod.PAY_LATER]: {
    accepted: ["LOAN_APPLICATION_FINISHED", "LOAN_DISBURSED"],
    rejected: ["CANCEL", "EXPIRED"],
  },
  // If CARD_PAY and DIRECT_API don't have statuses, you can leave them empty or add as needed.
  [PaymentMethod.CARD_PAY]: {
    accepted: ["OK", "CB"],
    rejected: ["FAIL"],
  },
  [PaymentMethod.DIRECT_API]: {
    accepted: ["OK", "CB"],
    rejected: ["FAIL"],
  },
};
