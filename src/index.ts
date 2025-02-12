import { GatewayMode, Scopes } from "./enums";
import createClient, { Middleware } from "openapi-fetch";
import { paths } from "./paths";
import { randomUUID } from "node:crypto";

export class TBPlusSDK {
  private clientId: string;
  private clientSecret: string;
  private scopes: Scopes[];
  private clientVersion: string = "1.0.0";

  public apiClient;
  public accessToken: string | undefined = undefined;
  UNPROTECTED_ROUTES = ["/auth/oauth/v2/token"];

  constructor(
    clientId: string,
    clientSecret: string,
    mode: GatewayMode = GatewayMode.SANDBOX,
    scopes: Scopes[] = [Scopes.TATRAPAYPLUS],
  ) {
    let baseUrl;
    if (mode == GatewayMode.PRODUCTION) {
      baseUrl = "https://api.tatrabanka.sk/tatrapayplus/production";
    } else if (mode == GatewayMode.SANDBOX) {
      baseUrl = "https://api.tatrabanka.sk/tatrapayplus/sandbox";
    } else {
      throw Error("Unknown gateway mode");
    }

    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.scopes = scopes;
    this.apiClient = createClient<paths>({
      baseUrl: baseUrl,
    });
    this.apiClient.use(this.getAuthMiddleware());
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

  public async createPayment(
    body: paths["/v1/payments"]["post"]["requestBody"]["content"]["application/json"],
    redirectUri: string,
  ) {
    return this.apiClient.POST("/v1/payments", {
      params: {
        header: { ...this.getDefaultHeaders(), "Redirect-URI": redirectUri },
      },
      body: body,
    });
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
