import { useState, type FormEvent } from "react";
import { useLocation, useNavigate, Navigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Logo } from "@/components/common/Logo";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { getErrorMessage } from "@/services/api";

interface LocationState {
  from?: { pathname: string };
}

export function LoginPage() {
  const { login, isAuthenticated, sessionExpired } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isAuthenticated) {
    const redirectTo = (location.state as LocationState | null)?.from?.pathname ?? "/dashboard";
    return <Navigate to={redirectTo} replace />;
  }

  function validate(): boolean {
    const errors: { email?: string; password?: string } = {};
    if (!email.trim()) errors.email = "Email is required.";
    else if (!/^\S+@\S+\.\S+$/.test(email)) errors.email = "Enter a valid email address.";
    if (!password) errors.password = "Password is required.";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await login(email, password);
      navigate("/dashboard", { replace: true });
    } catch (error) {
      setFormError(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo showSubtitle />
        </div>

        <div className="rounded-card border border-slate-200 bg-white p-6 shadow-card sm:p-8">
          <h1 className="text-xl">Welcome to MediFlow</h1>
          <p className="mt-1 text-sm text-slate-500">
            Sign in to manage patient care and clinic operations.
          </p>

          {sessionExpired && (
            <div
              role="alert"
              className="mt-4 rounded-md border border-warning-100 bg-warning-50 px-3 py-2 text-sm text-warning-700"
            >
              Your session expired. Please log in again.
            </div>
          )}

          {formError && (
            <div
              role="alert"
              className="mt-4 rounded-md border border-danger-100 bg-danger-50 px-3 py-2 text-sm text-danger-700"
            >
              {formError}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
            <Input
              label="Email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={fieldErrors.email}
              disabled={isSubmitting}
            />

            <div className="relative">
              <Input
                label="Password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={fieldErrors.password}
                disabled={isSubmitting}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((show) => !show)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-2.5 top-[34px] rounded p-1 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>

            <Button type="submit" className="w-full" isLoading={isSubmitting}>
              Sign in
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-400">
            Staff accounts are created by an administrator. There is no public registration.
          </p>
        </div>
      </div>
    </div>
  );
}
