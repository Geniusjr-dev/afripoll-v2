"use client";
import { WorkspaceProvider } from "@/lib/workspace";
import AuthGate from "@/components/AuthGate";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceProvider>
      <AuthGate>{children}</AuthGate>
    </WorkspaceProvider>
  );
}
