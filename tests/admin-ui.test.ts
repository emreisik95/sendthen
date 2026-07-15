import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  const file = new URL(`../${relativePath}`, import.meta.url);
  return existsSync(file) ? readFileSync(file, "utf8") : "";
}

const pagePath = "app/(dash)/admin/page.tsx";
const actionsPath = "app/admin-actions.ts";
const pageSource = readSource(pagePath);
const actionsSource = readSource(actionsPath);

describe("admin dashboard route", () => {
  it("exists and enforces instance-admin access before loading data", () => {
    expect(pageSource, `missing ${pagePath}`).not.toBe("");
    expect(pageSource).toContain("await requireUser()");
    expect(pageSource).toMatch(/user\.role\s*!==\s*["']admin["']/);
    expect(pageSource).toContain('redirect("/overview")');
    expect(pageSource).toContain("loadAdminDashboard(user.id, q)");
  });

  it("shows global user, admin, workspace, and domain totals", () => {
    expect(pageSource).toContain('title="User management"');
    for (const label of ["Users", "Admins", "Workspaces", "Verified domains"]) {
      expect(pageSource).toContain(`label: "${label}"`);
    }
    for (const field of [
      "summary.users",
      "summary.admins",
      "summary.workspaces",
      "summary.domains",
      "summary.verifiedDomains",
    ]) {
      expect(pageSource).toContain(field);
    }
  });

  it("provides a labelled GET search across users and domains", () => {
    expect(pageSource).toMatch(/<form[^>]*method="get"/);
    expect(pageSource).toContain('htmlFor="admin-search"');
    expect(pageSource).toContain('id="admin-search"');
    expect(pageSource).toContain('name="q"');
    expect(pageSource).toContain("Search users, emails, workspaces, or domains");
    expect(pageSource).toContain('href="/admin"');
  });

  it("renders nested workspace domains and accessible empty states", () => {
    expect(pageSource).toContain("account.workspaces.map");
    expect(pageSource).toContain("workspace.domains.map");
    expect(pageSource).toContain("<StatusPill status={domain.status}");
    expect(pageSource).toContain("No workspaces");
    expect(pageSource).toContain("No domains");
    expect(pageSource).toContain("No users match your search");
  });

  it("offers role management and guarded destructive account removal", () => {
    expect(pageSource).toContain("changeAdminUserRoleAction");
    expect(pageSource).toContain("deleteAdminUserAction");
    expect(pageSource).toContain('name="targetId"');
    expect(pageSource).toContain('name="role"');
    expect(pageSource).toContain('value="admin"');
    expect(pageSource).toContain('value="member"');
    expect(pageSource).toContain("account.isCurrent");
    expect(pageSource).toMatch(/<details[\s\S]*?Delete account/);
    expect(pageSource).toContain("Resources created by this user will be removed");
  });

  it("maps redirect codes to trusted accessible notices", () => {
    expect(pageSource).toContain("NOTICE_MESSAGES");
    expect(pageSource).toContain("ERROR_MESSAGES");
    expect(pageSource).toContain('role="status"');
    expect(pageSource).toContain('role="alert"');
    expect(pageSource).not.toMatch(/\{(?:notice|error)\}/);
  });
});

describe("admin dashboard server actions", () => {
  it("exists as a server-only mutation boundary", () => {
    expect(actionsSource, `missing ${actionsPath}`).not.toBe("");
    expect(actionsSource.trimStart()).toMatch(/^"use server";/);
    expect(actionsSource).toContain("export async function changeAdminUserRoleAction");
    expect(actionsSource).toContain("export async function deleteAdminUserAction");
  });

  it("derives the actor from the server session and accepts only target inputs", () => {
    expect(actionsSource.match(/await requireUser\(\)/g)).toHaveLength(2);
    expect(actionsSource).toContain("changeUserRole(actor.id, targetId, role)");
    expect(actionsSource).toContain("deleteUser(actor.id, targetId)");
    expect(actionsSource).not.toContain('formData.get("actorId")');
    expect(actionsSource).not.toContain('formData.get("userId")');
  });

  it("turns known operational errors into safe admin redirects", () => {
    expect(actionsSource).toContain("instanceof AdminOperationError");
    expect(actionsSource).toContain("error: error.code");
    expect(actionsSource).toContain('result.changed ? "role_updated"');
    expect(actionsSource).toContain("notice: \"user_deleted\"");
    expect(actionsSource).toContain("new URLSearchParams()");
    expect(actionsSource).toContain('redirect(`/admin${query ? `?${query}` : ""}`)');
  });
});
