/**
 * SendThen SDK — Resend-compatible client for your self-hosted instance.
 *
 *   const st = new SendThen("st_xxx", { baseUrl: "https://send.example.com" });
 *   const { id } = await st.emails.send({ from, to, subject, html });
 */

export interface SendEmailOptions {
  from: string;
  to: string | string[];
  subject?: string;
  html?: string;
  text?: string;
  cc?: string | string[];
  bcc?: string | string[];
  reply_to?: string | string[];
  headers?: Record<string, string>;
  tags?: Record<string, string>;
  attachments?: { filename: string; content: string; content_type?: string }[];
  scheduled_at?: string;
  track_opens?: boolean;
  track_clicks?: boolean;
  template_id?: string;
  variables?: Record<string, string>;
}

export interface SendThenOptions {
  baseUrl?: string;
  fetch?: typeof fetch;
}

export class SendThenError extends Error {
  constructor(
    public statusCode: number,
    public name: string,
    message: string,
  ) {
    super(message);
  }
}

export class SendThen {
  private baseUrl: string;
  private fetcher: typeof fetch;

  constructor(
    private apiKey: string,
    options: SendThenOptions = {},
  ) {
    this.baseUrl = (
      options.baseUrl ??
      process.env.SENDTHEN_BASE_URL ??
      "http://localhost:3000"
    ).replace(/\/$/, "");
    this.fetcher = options.fetch ?? fetch;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ): Promise<T> {
    const res = await this.fetcher(`${this.baseUrl}/api/v1${path}`, {
      method,
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const json = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      throw new SendThenError(
        res.status,
        String(json.name ?? "api_error"),
        String(json.message ?? "Request failed"),
      );
    }
    return json as T;
  }

  emails = {
    send: (
      options: SendEmailOptions,
      requestOptions: { idempotencyKey?: string } = {},
    ) =>
      this.request<{ id: string }>(
        "POST",
        "/emails",
        options,
        requestOptions.idempotencyKey
          ? { "idempotency-key": requestOptions.idempotencyKey }
          : {},
      ),
    batch: (items: SendEmailOptions[]) =>
      this.request<{ data: { id: string }[] }>("POST", "/emails/batch", items),
    get: (id: string) => this.request<Record<string, unknown>>("GET", `/emails/${id}`),
    list: () =>
      this.request<{ data: Record<string, unknown>[] }>("GET", "/emails"),
    cancel: (id: string) =>
      this.request<{ id: string }>("POST", `/emails/${id}/cancel`),
  };

  templates = {
    create: (tpl: {
      name: string;
      subject: string;
      html?: string;
      text?: string;
    }) => this.request<{ id: string }>("POST", "/templates", tpl),
    get: (id: string) =>
      this.request<Record<string, unknown>>("GET", `/templates/${id}`),
    list: () =>
      this.request<{ data: Record<string, unknown>[] }>("GET", "/templates"),
    update: (id: string, patch: Record<string, unknown>) =>
      this.request<{ id: string }>("PATCH", `/templates/${id}`, patch),
    remove: (id: string) =>
      this.request<{ id: string }>("DELETE", `/templates/${id}`),
  };

  audiences = {
    create: (name: string) =>
      this.request<{ id: string }>("POST", "/audiences", { name }),
    list: () =>
      this.request<{ data: Record<string, unknown>[] }>("GET", "/audiences"),
    remove: (id: string) =>
      this.request<{ id: string }>("DELETE", `/audiences/${id}`),
    contacts: {
      add: (
        audienceId: string,
        contact: { email: string; first_name?: string; last_name?: string },
      ) =>
        this.request<{ id: string }>(
          "POST",
          `/audiences/${audienceId}/contacts`,
          contact,
        ),
      list: (audienceId: string) =>
        this.request<{ data: Record<string, unknown>[] }>(
          "GET",
          `/audiences/${audienceId}/contacts`,
        ),
    },
  };

  broadcasts = {
    create: (broadcast: {
      audience_id: string;
      from: string;
      subject: string;
      html?: string;
      text?: string;
    }) => this.request<{ id: string }>("POST", "/broadcasts", broadcast),
    list: () =>
      this.request<{ data: Record<string, unknown>[] }>("GET", "/broadcasts"),
    send: (id: string) =>
      this.request<{ id: string; queued: number; skipped: number }>(
        "POST",
        `/broadcasts/${id}/send`,
      ),
  };

  domains = {
    create: (name: string) =>
      this.request<Record<string, unknown>>("POST", "/domains", { name }),
    get: (id: string) =>
      this.request<Record<string, unknown>>("GET", `/domains/${id}`),
    list: () =>
      this.request<{ data: Record<string, unknown>[] }>("GET", "/domains"),
    verify: (id: string) =>
      this.request<Record<string, unknown>>("POST", `/domains/${id}/verify`),
    remove: (id: string) =>
      this.request<{ id: string }>("DELETE", `/domains/${id}`),
  };

  apiKeys = {
    create: (name: string, permission: "full" | "sending" = "full") =>
      this.request<{ id: string; token: string }>("POST", "/api-keys", {
        name,
        permission,
      }),
    list: () =>
      this.request<{ data: Record<string, unknown>[] }>("GET", "/api-keys"),
    remove: (id: string) =>
      this.request<{ id: string }>("DELETE", `/api-keys/${id}`),
  };

  webhooks = {
    create: (url: string, events: string[]) =>
      this.request<{ id: string; secret: string }>("POST", "/webhooks", {
        url,
        events,
      }),
    list: () =>
      this.request<{ data: Record<string, unknown>[] }>("GET", "/webhooks"),
    remove: (id: string) =>
      this.request<{ id: string }>("DELETE", `/webhooks/${id}`),
  };
}
