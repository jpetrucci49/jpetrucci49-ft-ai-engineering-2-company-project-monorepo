import type { Metadata } from "next";
import "./globals.css";

import { TelemetryProvider } from "@/components/telemetry/TelemetryProvider";

export const metadata: Metadata = {
  title: "HealthCore Digital | Operations",
  description: "Internal HealthCore operations dashboard for billing, clinical, and workforce metrics.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <TelemetryProvider>{children}</TelemetryProvider>
      </body>
    </html>
  );
}
