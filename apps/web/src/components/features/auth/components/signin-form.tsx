"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@workspace/ui/components/button";
import { SigninFormValues, signinSchema } from "./validation";
import { FormInput, FormInputPassword } from "@/components/features/form/form-input";
import { FormCheckbox } from "@/components/features/form/form-checkbox";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Separator } from "@workspace/ui/components/separator";
import { useState } from "react";
import { useTranslations } from "next-intl";

export const SigninForm = () => {
  const [pending, setPending] = useState(false);
  const t = useTranslations("AuthPage.login");

  const router = useRouter();
  const form = useForm<SigninFormValues>({
    resolver: zodResolver(signinSchema),
    defaultValues: { email: "", password: "", remember: true },
  });

  async function onSubmit(data: SigninFormValues) {
    setPending(true);
    try {
      await authClient.signIn.email({
        ...data,
        rememberMe: data.remember,
        fetchOptions: {
          onError(context) {
            toast.error(context.error.message ?? context.error.statusText);
          },
          onSuccess() {
            router.push("/dashboard");
          },
        },
      });
    } catch {
      toast.error("Something went wrong");
    } finally {
      setPending(false);
    }
  }

  const loading = form.formState.isSubmitting || pending;

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="flex flex-col gap-4 p-6"
    >
      <FormInput
        control={form.control}
        name="email"
        label={t("email")}
        type="email"
        disabled={loading}
      />

      <FormInputPassword
        control={form.control}
        name="password"
        label={t("password")}
        disabled={loading}
      />

      <div className="flex w-full flex-1 items-center justify-between">
        <FormCheckbox
          control={form.control}
          name="remember"
          label={t("rememberMe")}
          disabled={loading}
        />

        <Link
          href={"/forgot-password"}
          className="block shrink-0 text-sm hover:underline hover:underline-offset-4 aria-disabled:pointer-events-none"
          aria-disabled={loading}
        >
          {t("forgotPassword")}
        </Link>
      </div>

      <Button type="submit" size={"lg"} className="w-full" disabled={loading}>
        {t("signIn")}
      </Button>

      {/* <div className="flex items-center justify-center my-4">
        <Separator className="flex-1 w-full" />
        <span className="shrink-0 text-sm text-muted-foreground px-4">{t("or")}</span>
        <Separator className="flex-1 w-full" />
      </div> */}

      {/* <div className="grid md:grid-cols-2 gap-4">
        <SocialButton
          logo={
            <Image src={"/github.png"} alt="Github" width={20} height={20} />
          }
          provider="github"
          onRequest={() => setPending(true)}
          onSuccess={() => setPending(false)}
          onResponse={() => setPending(false)}
          disabled={loading}
        />
        <SocialButton
          logo={
            <Image src={"/google.svg"} alt="Google" width={20} height={20} />
          }
          provider="google"
          onRequest={() => setPending(true)}
          onSuccess={() => setPending(false)}
          onResponse={() => setPending(false)}
          disabled={loading}
        />
      </div> */}
    </form>
  );
};
