import { Suspense } from "react";

import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { LoadingState } from "@/components/ui/LoadingState";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading…" />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
