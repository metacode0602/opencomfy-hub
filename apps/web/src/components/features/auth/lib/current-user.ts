"use server";

import { auth } from "@/lib/auth";
import { isExpired } from "@workspace/ui/lib/utils";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export async function currentUser(): Promise<typeof auth.$Infer.Session.user> {
  const response = await auth.api.getSession({ headers: await headers() });

  if (response == null) redirect("/signup");

  const { session, user } = response;

  if (isExpired(session.expiresAt)) redirect("/signin");

  return user;
}
