"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth-user";
import {
  AdminOperationError,
  changeUserRole,
  deleteUser,
} from "@/lib/admin";

type AdminRedirect = {
  notice?: "role_updated" | "role_unchanged" | "user_deleted";
  error?: AdminOperationError["code"];
  q?: string;
};

function formValue(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function redirectToAdmin(params: AdminRedirect): never {
  const search = new URLSearchParams();
  if (params.notice) search.set("notice", params.notice);
  if (params.error) search.set("error", params.error);
  if (params.q) search.set("q", params.q.slice(0, 200));
  const query = search.toString();
  redirect(`/admin${query ? `?${query}` : ""}`);
}

export async function changeAdminUserRoleAction(
  formData: FormData,
): Promise<void> {
  const actor = await requireUser();
  const targetId = formValue(formData, "targetId");
  const role = formValue(formData, "role");
  const q = formValue(formData, "q");

  try {
    const result = await changeUserRole(actor.id, targetId, role);
    redirectToAdmin({
      notice: result.changed ? "role_updated" : "role_unchanged",
      q,
    });
  } catch (error) {
    if (error instanceof AdminOperationError) {
      redirectToAdmin({ error: error.code, q });
    }
    throw error;
  }
}

export async function deleteAdminUserAction(
  formData: FormData,
): Promise<void> {
  const actor = await requireUser();
  const targetId = formValue(formData, "targetId");
  const q = formValue(formData, "q");

  try {
    await deleteUser(actor.id, targetId);
    redirectToAdmin({ notice: "user_deleted", q });
  } catch (error) {
    if (error instanceof AdminOperationError) {
      redirectToAdmin({ error: error.code, q });
    }
    throw error;
  }
}
