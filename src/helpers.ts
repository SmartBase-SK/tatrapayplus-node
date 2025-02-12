import { components } from "./paths";

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
