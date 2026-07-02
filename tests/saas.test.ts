import { describe, expect, it, beforeAll } from "vitest";
import { eq } from "drizzle-orm";
import { db, audiences, contacts, users } from "@/lib/db";
import { registerUser, verifyPassword, hashPassword } from "@/lib/auth-user";
import { createEmail, renderTemplate, SendError } from "@/lib/send-email";
import { addSuppression } from "@/lib/suppress";
import { injectTracking, trackSign, trackVerify } from "@/lib/tracking";
import { sendBroadcast } from "@/lib/broadcast";
import { newAudienceId, newBroadcastId, newContactId } from "@/lib/id";
import { broadcasts, emails } from "@/lib/db";

let userId: string;

beforeAll(async () => {
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, "saas@sendthen.dev"));
  const user =
    existing ?? (await registerUser("saas@sendthen.dev", "Saas", "password123"));
  userId = user.id;
});

describe("passwords", () => {
  it("hashes and verifies", () => {
    const hash = hashPassword("hunter22!");
    expect(verifyPassword("hunter22!", hash)).toBe(true);
    expect(verifyPassword("wrong", hash)).toBe(false);
  });
});

describe("templates", () => {
  it("renders {{variables}} and leaves unknowns intact", () => {
    expect(
      renderTemplate("Hi {{name}}, {{missing}}!", { name: "Emre" }),
    ).toBe("Hi Emre, {{missing}}!");
  });
});

describe("tracking", () => {
  it("signs and verifies click urls", () => {
    const sig = trackSign("em_abc", "https://x.dev");
    expect(trackVerify("em_abc", "https://x.dev", sig)).toBe(true);
    expect(trackVerify("em_abc", "https://evil.dev", sig)).toBe(false);
  });

  it("injects pixel and rewrites links when public url set", () => {
    process.env.SENDTHEN_PUBLIC_URL = "https://send.test";
    const html = injectTracking(
      '<a href="https://dest.com/x">go</a></body>',
      "em_1",
      { opens: true, clicks: true },
    );
    expect(html).toContain("https://send.test/t/o/em_1.gif");
    expect(html).toContain("https://send.test/t/c/em_1?u=");
    delete process.env.SENDTHEN_PUBLIC_URL;
  });
});

describe("suppressions", () => {
  it("blocks a fully-suppressed send", async () => {
    await addSuppression(userId, "blocked@example.com", "manual");
    await expect(
      createEmail(userId, null, {
        from: "hi@mail.test.dev",
        to: ["blocked@example.com"],
        subject: "nope",
        text: "x",
      }),
    ).rejects.toMatchObject({ code: "recipients_suppressed" });
  });
});

describe("broadcasts", () => {
  it("fans out to subscribed contacts with unsubscribe substitution", async () => {
    const audienceId = newAudienceId();
    await db.insert(audiences).values({
      id: audienceId,
      userId,
      name: "test-aud",
      createdAt: new Date(),
    });
    await db.insert(contacts).values([
      {
        id: newContactId(),
        audienceId,
        email: "a@example.com",
        firstName: "Ada",
        createdAt: new Date(),
      },
      {
        id: newContactId(),
        audienceId,
        email: "b@example.com",
        unsubscribed: true,
        createdAt: new Date(),
      },
    ]);
    const broadcastId = newBroadcastId();
    await db.insert(broadcasts).values({
      id: broadcastId,
      userId,
      audienceId,
      from: "news@mail.test.dev",
      subject: "Hi {{first_name}}",
      html: '<a href="{{unsubscribe_url}}">bye</a>',
      createdAt: new Date(),
    });

    const [broadcast] = await db
      .select()
      .from(broadcasts)
      .where(eq(broadcasts.id, broadcastId));
    const result = await sendBroadcast(broadcast);
    expect(result.queued).toBe(1);

    const fanned = await db
      .select()
      .from(emails)
      .where(eq(emails.broadcastId, broadcastId));
    expect(fanned).toHaveLength(1);
    expect(fanned[0].subject).toBe("Hi Ada");
    expect(fanned[0].html).toContain("/unsubscribe/con_");
    expect(fanned[0].headers?.["List-Unsubscribe"]).toContain("/unsubscribe/");

    // second send attempt rejected
    await expect(sendBroadcast(broadcast)).rejects.toBeInstanceOf(SendError);
  });
});
