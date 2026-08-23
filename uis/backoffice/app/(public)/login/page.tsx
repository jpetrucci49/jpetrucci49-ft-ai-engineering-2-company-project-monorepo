import { Suspense } from "react";

import { LoginForm } from "@/components/auth/LoginForm";
import { LoadingState } from "@/components/ui/LoadingState";

export default function LoginPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading…" />}>
      <LoginForm />
    </Suspense>
  );
}
