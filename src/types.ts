export type AccessTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
};

export type PaymentMethodsParams = {
  currencyCode?: string;
  totalAmount?: number;
  countryCode?: string;
};
