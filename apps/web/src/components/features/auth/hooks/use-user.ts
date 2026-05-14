import { authClient } from "@/lib/auth-client";
import { isExpired } from "@workspace/ui/lib/utils";
import { redirect } from "next/navigation";
import { toast } from "sonner";

export function useUser(): typeof authClient.$Infer.Session.user | null {
  const { data, error } = authClient.useSession();

  if (error != null) return null;

  if (data == null) return null;

  const {
    session: { expiresAt },
    user,
  } = data;

  if (isExpired(expiresAt)) {
    toast.error("Session has been expired, relogin.");
    redirect("/signin");
  }

  return user;
}
