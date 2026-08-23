import { Suspense } from "react";

import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { LoadingState } from "@/components/ui/LoadingState";

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading…" />}>
      <ForgotPasswordForm />
    </Suspense>
  );
}
