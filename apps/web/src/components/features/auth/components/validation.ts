import z from "zod";

export const signupSchema = z
  .object({
    name: z.string().min(1, { error: "Name is required" }),
    email: z
      .email({ error: "Invalid email provided" })
      .min(1, { error: "Email is required" }),
    password: z
      .string()
      .min(8, { error: "Password should be 8 characters at least" })
      .max(32, { error: "Password should be 32 characters at most" }),
    confirmPassword: z
      .string()
      .min(1, { error: "Please confirm your password" }),
    remember: z.boolean(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    error: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export type SignupFormValues = z.infer<typeof signupSchema>;

export const signinSchema = z.object({
  email: z
    .email({ error: "Invalid email provided" })
    .min(1, { error: "Email is required" }),
  password: z.string().min(1, { error: "Password is required" }),
  remember: z.boolean(),
});

export type SigninFormValues = z.infer<typeof signinSchema>;
