import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull().unique(),
    name: text("name").notNull(),
    // scrypt: salt:hash hex
    passwordHash: text("password_hash").notNull(),
    role: text("role", { enum: ["admin", "member"] })
      .notNull()
      .default("member"),
    // set when the user finishes or skips the getting-started tour
    onboardedAt: integer("onboarded_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [index("users_email_idx").on(t.email)],
);

export const teams = sqliteTable("teams", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const teamMembers = sqliteTable(
  "team_members",
  {
    id: text("id").primaryKey(),
    teamId: text("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["owner", "member"] })
      .notNull()
      .default("member"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [
    uniqueIndex("team_members_unique_idx").on(t.teamId, t.userId),
    index("team_members_user_idx").on(t.userId),
  ],
);

export const invites = sqliteTable(
  "invites",
  {
    id: text("id").primaryKey(),
    teamId: text("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role", { enum: ["owner", "member"] })
      .notNull()
      .default("member"),
    token: text("token").notNull().unique(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    acceptedAt: integer("accepted_at", { mode: "timestamp_ms" }),
  },
  (t) => [index("invites_team_idx").on(t.teamId)],
);

export const sessions = sqliteTable(
  "sessions",
  {
    // sha256 of the cookie token
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

/** Per-team mail transport + tracking settings (legacy table name). */
export const userSettings = sqliteTable("user_settings", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  teamId: text("team_id")
    .unique()
    .references(() => teams.id, { onDelete: "cascade" }),
  mailMode: text("mail_mode", {
    enum: ["inherit", "sandbox", "smtp", "ses"],
  })
    .notNull()
    .default("inherit"),
  smtpUrl: text("smtp_url"),
  sesAccessKeyId: text("ses_access_key_id"),
  sesSecretAccessKey: text("ses_secret_access_key"),
  sesRegion: text("ses_region"),
  trackOpens: integer("track_opens", { mode: "boolean" })
    .notNull()
    .default(false),
  trackClicks: integer("track_clicks", { mode: "boolean" })
    .notNull()
    .default(false),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const apiKeys = sqliteTable(
  "api_keys",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    teamId: text("team_id").references(() => teams.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(),
    // sha256 of full token; raw token shown once at creation
    tokenHash: text("token_hash").notNull().unique(),
    // first 12 chars (st_xxxxxxxx) for display
    tokenPrefix: text("token_prefix").notNull(),
    permission: text("permission", { enum: ["full", "sending"] })
      .notNull()
      .default("full"),
    // granular scopes; null = derive from legacy permission column
    scopes: text("scopes", { mode: "json" }).$type<string[]>(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    lastUsedAt: integer("last_used_at", { mode: "timestamp_ms" }),
    revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
  },
  (t) => [index("api_keys_hash_idx").on(t.tokenHash)],
);

export const domains = sqliteTable("domains", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  teamId: text("team_id").references(() => teams.id, { onDelete: "cascade" }),
  name: text("name").notNull().unique(),
  status: text("status", {
    enum: ["pending", "verified", "failed"],
  })
    .notNull()
    .default("pending"),
  // DKIM
  dkimSelector: text("dkim_selector").notNull().default("stmail"),
  dkimPrivateKey: text("dkim_private_key").notNull(),
  dkimPublicKey: text("dkim_public_key").notNull(),
  // resolved verification state per record
  dkimVerified: integer("dkim_verified", { mode: "boolean" })
    .notNull()
    .default(false),
  spfVerified: integer("spf_verified", { mode: "boolean" })
    .notNull()
    .default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  verifiedAt: integer("verified_at", { mode: "timestamp_ms" }),
  lastCheckedAt: integer("last_checked_at", { mode: "timestamp_ms" }),
});

export interface EmailAttachment {
  filename: string;
  content: string; // base64
  content_type?: string;
}

export const emails = sqliteTable(
  "emails",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    teamId: text("team_id").references(() => teams.id, {
      onDelete: "cascade",
    }),
    domainId: text("domain_id").references(() => domains.id),
    apiKeyId: text("api_key_id").references(() => apiKeys.id),
    templateId: text("template_id"),
    broadcastId: text("broadcast_id"),
    contactId: text("contact_id"),
    from: text("from").notNull(),
    to: text("to", { mode: "json" }).$type<string[]>().notNull(),
    cc: text("cc", { mode: "json" }).$type<string[]>(),
    bcc: text("bcc", { mode: "json" }).$type<string[]>(),
    replyTo: text("reply_to", { mode: "json" }).$type<string[]>(),
    subject: text("subject").notNull(),
    html: text("html"),
    text: text("text"),
    headers: text("headers", { mode: "json" }).$type<Record<string, string>>(),
    tags: text("tags", { mode: "json" }).$type<Record<string, string>>(),
    attachments: text("attachments", { mode: "json" }).$type<
      EmailAttachment[]
    >(),
    trackOpens: integer("track_opens", { mode: "boolean" })
      .notNull()
      .default(false),
    trackClicks: integer("track_clicks", { mode: "boolean" })
      .notNull()
      .default(false),
    status: text("status", {
      enum: [
        "queued",
        "sending",
        "sent",
        "delivered",
        "bounced",
        "failed",
        "canceled",
      ],
    })
      .notNull()
      .default("queued"),
    // SMTP message-id after send
    messageId: text("message_id"),
    scheduledAt: integer("scheduled_at", { mode: "timestamp_ms" }),
    sentAt: integer("sent_at", { mode: "timestamp_ms" }),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: integer("next_attempt_at", { mode: "timestamp_ms" }),
    lastError: text("last_error"),
    idempotencyKey: text("idempotency_key"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [
    index("emails_status_idx").on(t.status, t.nextAttemptAt),
    index("emails_created_idx").on(t.createdAt),
    index("emails_idem_idx").on(t.idempotencyKey),
    index("emails_user_idx").on(t.userId, t.createdAt),
    index("emails_team_idx").on(t.teamId, t.createdAt),
    index("emails_broadcast_idx").on(t.broadcastId),
  ],
);

export const EVENT_TYPES = [
  "email.queued",
  "email.sent",
  "email.delivered",
  "email.bounced",
  "email.complained",
  "email.failed",
  "email.canceled",
  "email.opened",
  "email.clicked",
] as const;

export const emailEvents = sqliteTable(
  "email_events",
  {
    id: text("id").primaryKey(),
    emailId: text("email_id")
      .notNull()
      .references(() => emails.id),
    type: text("type", { enum: EVENT_TYPES }).notNull(),
    data: text("data", { mode: "json" }).$type<Record<string, unknown>>(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [
    index("email_events_email_idx").on(t.emailId),
    index("email_events_type_idx").on(t.type, t.createdAt),
  ],
);

export const webhooks = sqliteTable("webhooks", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  teamId: text("team_id").references(() => teams.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  // whsec_-prefixed HMAC secret
  secret: text("secret").notNull(),
  events: text("events", { mode: "json" }).$type<string[]>().notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const webhookDeliveries = sqliteTable(
  "webhook_deliveries",
  {
    id: text("id").primaryKey(),
    webhookId: text("webhook_id")
      .notNull()
      .references(() => webhooks.id),
    eventId: text("event_id")
      .notNull()
      .references(() => emailEvents.id),
    status: text("status", { enum: ["pending", "success", "failed"] })
      .notNull()
      .default("pending"),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: integer("next_attempt_at", { mode: "timestamp_ms" }),
    responseStatus: integer("response_status"),
    responseBody: text("response_body"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    deliveredAt: integer("delivered_at", { mode: "timestamp_ms" }),
  },
  (t) => [index("wh_deliveries_status_idx").on(t.status, t.nextAttemptAt)],
);

export const suppressions = sqliteTable(
  "suppressions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    teamId: text("team_id").references(() => teams.id, {
      onDelete: "cascade",
    }),
    email: text("email").notNull(),
    reason: text("reason", {
      enum: ["bounce", "complaint", "manual", "failed"],
    }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [
    uniqueIndex("suppressions_user_email_idx").on(t.userId, t.email),
    index("suppressions_team_idx").on(t.teamId, t.email),
  ],
);

export const templates = sqliteTable(
  "templates",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    teamId: text("team_id").references(() => teams.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(),
    subject: text("subject").notNull(),
    html: text("html"),
    text: text("text"),
    // builder design JSON — present when created with the visual builder
    design: text("design", { mode: "json" }).$type<Record<string, unknown>>(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [index("templates_user_idx").on(t.userId)],
);

export const audiences = sqliteTable(
  "audiences",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    teamId: text("team_id").references(() => teams.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [index("audiences_user_idx").on(t.userId)],
);

export const contacts = sqliteTable(
  "contacts",
  {
    id: text("id").primaryKey(),
    audienceId: text("audience_id")
      .notNull()
      .references(() => audiences.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    firstName: text("first_name"),
    lastName: text("last_name"),
    unsubscribed: integer("unsubscribed", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [
    uniqueIndex("contacts_audience_email_idx").on(t.audienceId, t.email),
  ],
);

export const broadcasts = sqliteTable(
  "broadcasts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    teamId: text("team_id").references(() => teams.id, {
      onDelete: "cascade",
    }),
    audienceId: text("audience_id")
      .notNull()
      .references(() => audiences.id),
    from: text("from").notNull(),
    subject: text("subject").notNull(),
    html: text("html"),
    text: text("text"),
    status: text("status", {
      enum: ["draft", "sending", "sent", "failed"],
    })
      .notNull()
      .default("draft"),
    sentAt: integer("sent_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [index("broadcasts_user_idx").on(t.userId)],
);

export const inboundEmails = sqliteTable(
  "inbound_emails",
  {
    id: text("id").primaryKey(),
    teamId: text("team_id").references(() => teams.id, {
      onDelete: "cascade",
    }),
    domainId: text("domain_id").references(() => domains.id),
    from: text("from").notNull(),
    to: text("to", { mode: "json" }).$type<string[]>().notNull(),
    cc: text("cc", { mode: "json" }).$type<string[]>(),
    subject: text("subject").notNull().default(""),
    html: text("html"),
    text: text("text"),
    headers: text("headers", { mode: "json" }).$type<Record<string, string>>(),
    messageId: text("message_id"),
    attachments: text("attachments", { mode: "json" }).$type<
      { filename: string; contentType: string; size: number; content: string }[]
    >(),
    read: integer("read", { mode: "boolean" }).notNull().default(false),
    // set when this inbound email was forwarded (outbound email id)
    forwardedTo: text("forwarded_to"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [
    index("inbound_team_idx").on(t.teamId, t.createdAt),
    index("inbound_message_idx").on(t.messageId),
  ],
);

export type InboundEmail = typeof inboundEmails.$inferSelect;

export type User = typeof users.$inferSelect;
export type Team = typeof teams.$inferSelect;
export type TeamMember = typeof teamMembers.$inferSelect;
export type Invite = typeof invites.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type UserSettings = typeof userSettings.$inferSelect;
export type ApiKey = typeof apiKeys.$inferSelect;
export type Domain = typeof domains.$inferSelect;
export type Email = typeof emails.$inferSelect;
export type EmailEvent = typeof emailEvents.$inferSelect;
export type Webhook = typeof webhooks.$inferSelect;
export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;
export type Suppression = typeof suppressions.$inferSelect;
export type Template = typeof templates.$inferSelect;
export type Audience = typeof audiences.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
export type Broadcast = typeof broadcasts.$inferSelect;
