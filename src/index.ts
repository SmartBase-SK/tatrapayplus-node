import { APIClient } from "./client";

export class TBPlusSDK {
  private apiClient: APIClient;

  constructor(
    apiKey: string,
    apiSecret: string,
    baseUrl: string = "https://api.tatrabanka.sk/tatrapayplus/sandbox",
    scopes: string = "TATRAPAYPLUS",
  ) {
    this.apiClient = new APIClient(apiKey, apiSecret, baseUrl, scopes);
  }

  async getPaymentsMethods() {
    return this.apiClient.get(`/v1/payments/methods`);
  }

  async createUser(name: string, email: string) {
    return this.apiClient.post(`/users`, { name, email });
  }
}
