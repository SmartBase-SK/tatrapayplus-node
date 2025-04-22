type AnyObject = Record<string, unknown>;

export class TBPlusLogger {
  private maskSensitiveData: boolean;
  private maskBodyFields: string[] = [
    "client_id",
    "client_secret",
    "access_token",
  ];
  private maskHeaderFields: string[] = ["authorization"];

  constructor(maskSensitiveData = true) {
    this.maskSensitiveData = maskSensitiveData;
  }

  private maskValue(value: string, keep = 5): string {
    if (typeof value !== "string" || value.length <= keep * 2) {
      return "*".repeat(value.length);
    }
    return (
      value.slice(0, keep) +
      "*".repeat(value.length - 2 * keep) +
      value.slice(-keep)
    );
  }

  private maskBody(body: unknown): unknown {
    if (!this.maskSensitiveData || !body) return body;

    const masked = { ...body };

    for (const key of this.maskBodyFields) {
      if (masked[key]) {
        masked[key] = this.maskValue(String(masked[key]));
      }
    }

    return masked;
  }

  private maskHeaders(headers: Headers | AnyObject): AnyObject {
    const rawHeaders: AnyObject =
      headers instanceof Headers
        ? Object.fromEntries(headers.entries())
        : headers;
    const masked: AnyObject = {};

    for (const key in rawHeaders) {
      masked[key] = this.maskHeaderFields.includes(key)
        ? this.maskValue(String(rawHeaders[key]))
        : rawHeaders[key];
    }

    return masked;
  }

  public async log(request: Request, response: Response): Promise<void> {
    const requestClone = request.clone();
    const bodyText = await requestClone.text();
    const parsedBody = (() => {
      try {
        return JSON.parse(bodyText);
      } catch {
        return bodyText;
      }
    })();

    const maskedBody = this.maskBody(parsedBody);
    const maskedHeaders = this.maskHeaders(request.headers);

    this.writeLine(`Request: ${request.method} ${request.url}`);
    this.writeLine(`Headers: ${JSON.stringify(maskedHeaders, null, 2)}`);
    if (bodyText) {
      this.writeLine(`Body: ${JSON.stringify(maskedBody, null, 2)}`);
    }

    const resText = await response.clone().text();
    let resParsed;
    try {
      resParsed = JSON.parse(resText);
    } catch {
      resParsed = resText;
    }

    this.writeLine(`Response Status: ${response.status}`);
    this.writeLine(
      `Response: ${JSON.stringify(this.maskBody(resParsed), null, 2)}\n`,
    );
  }

  protected writeLine(line: string): void {
    console.log(line);
  }
}
