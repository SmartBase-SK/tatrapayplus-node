import { GatewayMode, Scopes } from "./enums";
import createClient, { ClientOptions, Middleware } from "openapi-fetch";
import { components, paths } from "./paths";
import { randomUUID } from "node:crypto";
import {
  removeCharacterFromStrings,
  removeDiacritics,
  trimAndRemoveSpecialCharacters,
} from "./helpers";
import { PaymentMethodsParams } from "./types";

export class TBPlusSDK {
  private clientId: string;
  private clientSecret: string;
  private mode: GatewayMode;
  private scopes: Scopes[];
  private clientVersion: string = "1.0.0";
  private retryStatues: number[] = [500, 502, 503, 504];

  public baseUrl: string;
  public apiClient;
  public accessToken: string | undefined = undefined;
  UNPROTECTED_ROUTES = ["/auth/oauth/v2/token"];

  constructor(
    clientId: string,
    clientSecret: string,
    sdkOptions: {
      mode?: GatewayMode;
      scopes?: Scopes[];
      createClientParams?: ClientOptions;
    } = {},
  ) {
    this.mode = sdkOptions.mode ?? GatewayMode.SANDBOX;
    if (this.mode == GatewayMode.PRODUCTION) {
      this.baseUrl = "https://api.tatrabanka.sk/tatrapayplus/production";
    } else if (this.mode == GatewayMode.SANDBOX) {
      this.baseUrl = "https://api.tatrabanka.sk/tatrapayplus/sandbox";
    } else {
      throw Error("Unknown gateway mode");
    }

    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.scopes = sdkOptions.scopes ?? [Scopes.TATRAPAYPLUS];
    this.apiClient = createClient<paths>({
      baseUrl: this.baseUrl,
      ...sdkOptions.createClientParams,
    });
    this.apiClient.use(this.getAuthMiddleware());
    this.apiClient.use(this.getRetryMiddleware());
  }

  getAuthMiddleware(): Middleware {
    return {
      onRequest: async ({ schemaPath, request }) => {
        if (
          this.UNPROTECTED_ROUTES.some((pathname) =>
            schemaPath.startsWith(pathname),
          )
        ) {
          return undefined;
        }
        if (!this.accessToken) {
          this.accessToken = await this.fetchAccessToken();
        }

        request.headers.set("Authorization", `Bearer ${this.accessToken}`);
        return request;
      },
    };
  }

  getRetryMiddleware(maxRetries = 3, delay = 100): Middleware {
    return {
      onRequest: async ({ request }) => {
        return request.clone();
      },
      onResponse: async ({ request, response }) => {
        if (!this.retryStatues.includes(response.status)) {
          return response;
        }
        let attempt = 0;
        let lastResponse = response;

        while (attempt < maxRetries) {
          const waitTime = delay * 2 ** attempt;
          console.log(`Retry attempt ${attempt + 1}, waiting ${waitTime}ms`);
          await new Promise((res) => setTimeout(res, waitTime));

          lastResponse = await fetch(request);
          if (!this.retryStatues.includes(lastResponse.status)) {
            return lastResponse; // Successful response, return it
          }

          attempt++;
        }

        return lastResponse; // Return the last failed response
      },
    };
  }

  private getDefaultHeaders() {
    const defaultHeaders: Record<
      "X-Request-ID" | "IP-Address" | "User-Agent",
      string
    > = {
      "X-Request-ID": randomUUID(),
      "IP-Address": "127.0.0.1",
      "User-Agent": `Tatrapayplus-plugin/${this.clientVersion}/Node.js`,
    };
    return defaultHeaders;
  }

  private async fetchAccessToken(): Promise<string | undefined> {
    const { data, error } = await this.apiClient.POST("/auth/oauth/v2/token", {
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body: {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: "client_credentials",
        scope: this.scopes.join(","),
      },
      bodySerializer(body) {
        return new URLSearchParams(body).toString();
      },
    });
    if (error) {
      throw Error("Unable to retrieve access token" + error.error_description);
    } else {
      return data.access_token;
    }
  }

  public preProcessCreatePaymentBody(
    body: paths["/v1/payments"]["post"]["requestBody"]["content"]["application/json"],
  ) {
    body = removeCharacterFromStrings(body);

    if (body.cardDetail?.cardHolder) {
      body.cardDetail.cardHolder = trimAndRemoveSpecialCharacters(
        removeDiacritics(body.cardDetail.cardHolder),
      );
    }
    return body;
  }

  public async createPayment(
    body: paths["/v1/payments"]["post"]["requestBody"]["content"]["application/json"],
    redirectUri: string,
    fetchOptions = {},
  ) {
    body = this.preProcessCreatePaymentBody(body);
    return this.apiClient.POST("/v1/payments", {
      params: {
        header: { ...this.getDefaultHeaders(), "Redirect-URI": redirectUri },
      },
      body: body,
      ...fetchOptions,
    });
  }

  public async getAvailablePaymentMethods({
    currencyCode,
    totalAmount,
    countryCode,
  }: PaymentMethodsParams = {}) {
    const response = await this.getPaymentMethods();
    if (!response.data) {
      return response;
    }
    const newData = response.data.paymentMethods.filter((method) => {
      if (
        currencyCode &&
        method.supportedCurrency &&
        !method.supportedCurrency.includes(currencyCode)
      ) {
        return false;
      }

      if (method.amountRangeRule && totalAmount) {
        const { minAmount = 0, maxAmount = Infinity } = method.amountRangeRule;
        if (totalAmount < minAmount || totalAmount > maxAmount) {
          return false;
        }
      }

      if (
        countryCode &&
        method.supportedCountry &&
        !method.supportedCountry.includes(countryCode)
      ) {
        return false;
      }

      return true;
    });
    return {
      ...response,
      data: newData,
    };
  }

  public async getPaymentMethods() {
    return this.apiClient.GET("/v1/payments/methods", {
      params: { header: { ...this.getDefaultHeaders() } },
    });
  }

  public async getPaymentStatus(paymentId: string) {
    return this.apiClient.GET("/v1/payments/{payment-id}/status", {
      params: {
        header: { ...this.getDefaultHeaders() },
        path: { "payment-id": paymentId },
      },
    });
  }

  public async updatePayment(
    paymentId: string,
    body: paths["/v1/payments/{payment-id}"]["patch"]["requestBody"]["content"]["application/json"],
  ) {
    const headers = this.getDefaultHeaders();
    return this.apiClient.PATCH("/v1/payments/{payment-id}", {
      params: {
        header: { ...headers, "Idempotency-Key": headers["X-Request-ID"] },
        path: { "payment-id": paymentId },
      },
      body: body,
    });
  }

  public async cancelPayment(paymentId: string) {
    return this.apiClient.DELETE("/v1/payments/{payment-id}", {
      params: {
        header: { ...this.getDefaultHeaders() },
        path: { "payment-id": paymentId },
      },
    });
  }

  public async setAppearances(
    body: paths["/v1/appearances"]["post"]["requestBody"]["content"]["application/json"],
  ) {
    return this.apiClient.POST("/v1/appearances", {
      params: { header: { ...this.getDefaultHeaders() } },
      body: body,
    });
  }

  public async setAppearancesLogo(
    body: paths["/v1/appearances/logo"]["post"]["requestBody"]["content"]["application/json"],
  ) {
    return this.apiClient.POST("/v1/appearances/logo", {
      params: { header: { ...this.getDefaultHeaders() } },
      body: body,
    });
  }

  public async createPaymentDirect(
    body: paths["/v1/payments-direct"]["post"]["requestBody"]["content"]["application/json"],
    redirectUri: string,
  ) {
    return this.apiClient.POST("/v1/payments-direct", {
      params: {
        header: { ...this.getDefaultHeaders(), "Redirect-URI": redirectUri },
      },
      body: body,
    });
  }
}
