import { DashboardShell } from "@/components/dashboard-shell";
import { requireUser } from "@/lib/auth-user";
import { onboardingProgress } from "@/lib/onboarding";
import { getActiveTeam, membershipsOf } from "@/lib/team";

export default async function DashLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const { team } = await getActiveTeam(user);
  const memberships = await membershipsOf(user.id);
  const setup = user.onboardedAt ? null : await onboardingProgress(team);

  const userSummary = {
    name: user.name,
    email: user.email,
    role: user.role,
  };
  const teamSummary = {
    id: team.id,
    name: team.name,
  };
  const membershipSummaries = memberships.map(({ team: membershipTeam }) => ({
    id: membershipTeam.id,
    name: membershipTeam.name,
  }));
  const setupSummary = setup
    ? {
        domainVerified: setup.domainVerified,
        hasApiKey: setup.hasApiKey,
        hasSentEmail: setup.hasSentEmail,
      }
    : null;

  return (
    <DashboardShell
      userSummary={userSummary}
      teamSummary={teamSummary}
      membershipSummaries={membershipSummaries}
      setupSummary={setupSummary}
    >
      {children}
    </DashboardShell>
  );
}
