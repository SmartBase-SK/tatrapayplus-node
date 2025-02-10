import https from "https";
import http from "http";
import { URL } from "url";
import { AccessTokenResponse } from "./types";
import querystring from "querystring";
import { randomUUID } from "node:crypto";

export class APIClient {
  private clientId: string;
  private clientSecret: string;
  private baseUrl: string;
  private scopes: string;
  private accessToken: string | null = null;

  constructor(
    clientId: string,
    clientSecret: string,
    baseUrl: string,
    scopes: string,
  ) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.baseUrl = baseUrl;
    this.scopes = scopes;
  }

  private getDefaultHeaders() {
    const defaultHeaders: Record<string, string> = {};
    defaultHeaders["X-Request-ID"] = randomUUID();
    defaultHeaders["IP-Address"] = "127.0.0.1";
    defaultHeaders["User-Agent"] = `Tatrapayplus-plugin/1.0.0/Node.js`; // TODO
    return defaultHeaders;
  }

  private request<T>(
    endpoint: string,
    method: string = "GET",
    body?: unknown,
    requiresAuth: boolean = true,
    contentType: string = "application/json",
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const url = new URL(this.baseUrl + endpoint);
      const client = url.protocol === "https:" ? https : http;
      let requestBody;
      if (contentType === "application/json") {
        requestBody = JSON.stringify(body);
      } else {
        requestBody = querystring.stringify(
          body as querystring.ParsedUrlQueryInput,
        );
      }

      const options: https.RequestOptions = {
        method,
        headers: {
          "Content-Type": contentType,
          ...this.getDefaultHeaders(),
          ...(requestBody && {
            "Content-Length": Buffer.byteLength(requestBody),
          }),
          ...(requiresAuth && {
            Authorization: `Bearer ${this.accessToken}`,
          }),
        },
      };

      const req = client.request(url, options, (res) => {
        let data = "";

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 400 && res.statusCode < 600) {
            reject(
              new Error(`Request failed with status code ${res.statusCode}`),
            );
          }

          try {
            const parsedData = JSON.parse(data);
            resolve(parsedData);
          } catch {
            reject(new Error("Failed to parse response"));
          }
        });
      });

      req.on("error", (error) => {
        reject(error);
      });

      if (body) {
        req.write(requestBody);
      }

      req.end();
    });
  }

  async get<T>(endpoint: string): Promise<T> {
    if (!this.accessToken) {
      await this.getAccessToken();
    }

    return this.request<T>(endpoint, "GET");
  }

  async post<T>(endpoint: string, body: unknown): Promise<T> {
    if (!this.accessToken) {
      await this.getAccessToken();
    }
    return this.request<T>(endpoint, "POST", body);
  }

  async getAccessToken() {
    try {
      const result: AccessTokenResponse = await this.request(
        `/auth/oauth/v2/token`,
        "POST",
        {
          client_id: this.clientId,
          client_secret: this.clientSecret,
          scope: this.scopes,
          grant_type: "client_credentials",
        },
        false,
        "application/x-www-form-urlencoded",
      );
      this.accessToken = result.access_token;
    } catch (error) {
      //   todo
      console.error("Rejected:", error);
    }
  }
}
