import { useState, type FormEvent } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { Button } from "../components/common/Button";

// Signup / login screen (FR-001, FR-002). The Password provider selects the flow
// via a hidden `flow` field; sign-up also captures display name + avatar URL.
export function AuthPage() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const formData = new FormData(event.currentTarget);
    formData.set("flow", flow);
    try {
      await signIn("password", formData);
    } catch {
      setError(
        flow === "signIn"
          ? "Incorrect email or password."
          : "Could not create account. The email may already be in use.",
      );
      setSubmitting(false);
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-rail p-4">
      <div className="w-full max-w-sm rounded-lg bg-chat p-8 shadow-xl">
        <h1 className="mb-1 text-2xl font-bold text-text-normal">
          {flow === "signIn" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="mb-6 text-sm text-text-muted">
          {flow === "signIn"
            ? "Sign in to continue."
            : "Pick a display name and avatar."}
        </p>

        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          {flow === "signUp" && (
            <>
              <Field
                name="name"
                label="Display name"
                type="text"
                required
                maxLength={32}
                autoComplete="nickname"
              />
              <Field
                name="image"
                label="Avatar image URL (optional)"
                type="url"
                placeholder="https://…"
                autoComplete="off"
              />
            </>
          )}
          <Field
            name="email"
            label="Email"
            type="email"
            required
            autoComplete="email"
          />
          <Field
            name="password"
            label="Password"
            type="password"
            required
            autoComplete={
              flow === "signIn" ? "current-password" : "new-password"
            }
          />

          {error && (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" disabled={submitting} className="mt-2">
            {submitting
              ? "Please wait…"
              : flow === "signIn"
                ? "Sign in"
                : "Sign up"}
          </Button>
        </form>

        <button
          type="button"
          className="mt-4 w-full text-center text-sm text-text-muted hover:text-text-normal"
          onClick={() => {
            setFlow(flow === "signIn" ? "signUp" : "signIn");
            setError(null);
          }}
        >
          {flow === "signIn"
            ? "Need an account? Sign up"
            : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}

function Field({
  name,
  label,
  ...props
}: { name: string; label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1 text-left">
      <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
        {label}
      </span>
      <input
        name={name}
        className="rounded bg-rail px-3 py-2 text-text-normal outline-none ring-accent focus:ring-2"
        {...props}
      />
    </label>
  );
}
