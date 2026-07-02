import { beforeAll, describe, expect, it } from "vitest";
import { desc, eq } from "drizzle-orm";
import {
  db,
  domains,
  emails,
  inboundEmails,
  users,
} from "@/lib/db";
import { registerUser } from "@/lib/auth-user";
import { createTeam } from "@/lib/team";
import { generateDkimKeyPair } from "@/lib/dkim";
import { newDomainId } from "@/lib/id";
import { parseAndStoreInbound, forwardInbound } from "@/lib/inbound";

let userId: string;
let teamId: string;
const DOMAIN = "inbox.test.dev";

beforeAll(async () => {
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, "inbound@sendthen.dev"));
  const user =
    existing ??
    (await registerUser("inbound@sendthen.dev", "Inbound", "password123"));
  userId = user.id;
  const team = await createTeam("inbound team", userId);
  teamId = team.id;
  const { privateKey, publicKey } = generateDkimKeyPair();
  await db.insert(domains).values({
    id: newDomainId(),
    userId,
    teamId,
    name: DOMAIN,
    status: "verified",
    dkimPrivateKey: privateKey,
    dkimPublicKey: publicKey,
    createdAt: new Date(),
  });
});

const rawMail = (subject: string) =>
  Buffer.from(
    [
      "From: Sender <someone@external.example>",
      `To: hello@${DOMAIN}, other@unknown.example`,
      `Subject: ${subject}`,
      `Message-ID: <${Date.now()}@external.example>`,
      "Content-Type: text/plain; charset=utf-8",
      "",
      "Inbound body line.",
    ].join("\r\n"),
  );

describe("inbound email", () => {
  it("stores mail for the owning team and ignores unknown domains", async () => {
    const { stored } = await parseAndStoreInbound(rawMail("First inbound"));
    expect(stored).toBe(1);

    const [row] = await db
      .select()
      .from(inboundEmails)
      .where(eq(inboundEmails.teamId, teamId))
      .orderBy(desc(inboundEmails.createdAt))
      .limit(1);
    expect(row.subject).toBe("First inbound");
    expect(row.from).toContain("someone@external.example");
    expect(row.text).toContain("Inbound body line");
  });

  it("forwards through the team transport with Fwd: subject", async () => {
    await parseAndStoreInbound(rawMail("Forward me"));
    const [row] = await db
      .select()
      .from(inboundEmails)
      .where(eq(inboundEmails.teamId, teamId))
      .orderBy(desc(inboundEmails.createdAt))
      .limit(1);

    const { id } = await forwardInbound(row, "dest@elsewhere.example", userId);
    expect(id).toMatch(/^em_/);

    const [outbound] = await db.select().from(emails).where(eq(emails.id, id));
    expect(outbound.subject).toBe("Fwd: Forward me");
    expect(outbound.to).toEqual(["dest@elsewhere.example"]);
    expect(outbound.teamId).toBe(teamId);

    const [fresh] = await db
      .select()
      .from(inboundEmails)
      .where(eq(inboundEmails.id, row.id));
    expect(fresh.forwardedTo).toBe(id);
  });
});
