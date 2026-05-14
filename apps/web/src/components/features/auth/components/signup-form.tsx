"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@workspace/ui/components/button";
import { SignupFormValues, signupSchema } from "./validation";
import { FormInput, FormInputPassword } from "@/components/features/form/form-input";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { FormCheckbox } from "@/components/features/form/form-checkbox";
import { serverSignUp } from "../actions";
import { Separator } from "@workspace/ui/components/separator";
import { SocialButton } from "./social-button";
import Image from "next/image";
import { useState } from "react";

export const SignupForm = () => {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      remember: true,
    },
  });

  async function onSubmit(data: SignupFormValues) {
    setPending(true);
    try {
      const res = await serverSignUp(data);

      if (res?.error) {
        toast.error(res.message);

        return;
      }
      router.push("/dashboard");
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
      className="flex flex-col gap-4"
    >
      <FormInput
        control={form.control}
        name="name"
        label="Name"
        disabled={loading}
      />

      <FormInput
        control={form.control}
        name="email"
        label="Email"
        type="email"
        disabled={loading}
      />

      <FormInputPassword
        control={form.control}
        name="password"
        label="Password"
        disabled={loading}
      />

      <FormInputPassword
        control={form.control}
        name="confirmPassword"
        label="Confirm password"
        disabled={loading}
      />

      <FormCheckbox
        control={form.control}
        name="remember"
        label="Remember me"
        disabled={loading}
      />

      <Button type="submit" size={"lg"} className="w-full" disabled={loading}>
        Sign up
      </Button>

      <div className="flex items-center justify-center my-4">
        <Separator className="flex-1 w-full" />
        <span className="shrink-0 text-sm text-muted-foreground px-4">OR</span>
        <Separator className="flex-1 w-full" />
      </div>

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
