"use client";

import { Button } from "@workspace/ui/components/button";
import { authClient } from "@/lib/auth-client";
import { ReactNode } from "react";
import { toast } from "sonner";

type ConfigueredProvider = "github" | "google" | "facebook"; // Can add as you want ex: google

interface SocialButtonProps {
  provider: ConfigueredProvider;
  logo: ReactNode;
  className?: string;
  onSuccess?: () => void;
  onRequest?: () => void;
  onResponse?: () => void;
  disabled: boolean;
}

export const SocialButton = ({
  logo,
  provider,
  className,
  onSuccess,
  onRequest,
  onResponse,
  disabled = false,
}: SocialButtonProps) => {
  async function handleAction() {
    await authClient.signIn.social(
      { provider },
      {
        onError(ctx) {
          toast.error(ctx.error.message ?? ctx.error.statusText);
        },
        onSuccess,
        onRequest,
        onResponse,
      }
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      className={className}
      onClick={handleAction}
      disabled={disabled}
    >
      {logo}
      Continue with
      <span className="font-medium capitalize -ml-1">{provider}</span>
    </Button>
  );
};
