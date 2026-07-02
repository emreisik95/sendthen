import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db, invites, teamMembers } from "@/lib/db";
import { getSessionUser } from "@/lib/auth-user";
import { setActiveTeamCookie } from "@/lib/team";
import { newMemberId } from "@/lib/id";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const url = new URL(req.url);

  const [invite] = await db
    .select()
    .from(invites)
    .where(and(eq(invites.token, token), isNull(invites.acceptedAt)));
  if (!invite) {
    return NextResponse.redirect(new URL("/login?error=bad_invite", url));
  }

  const user = await getSessionUser();
  if (!user) {
    // land on signup with the token; login page links carry it too
    return NextResponse.redirect(new URL(`/signup?invite=${token}`, url));
  }

  await db
    .insert(teamMembers)
    .values({
      id: newMemberId(),
      teamId: invite.teamId,
      userId: user.id,
      role: invite.role,
      createdAt: new Date(),
    })
    .onConflictDoNothing();
  await db
    .update(invites)
    .set({ acceptedAt: new Date() })
    .where(eq(invites.id, invite.id));
  await setActiveTeamCookie(invite.teamId);

  return NextResponse.redirect(new URL("/team", url));
}
