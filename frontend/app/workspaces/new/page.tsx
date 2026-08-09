"use client";

import { WorkspaceOnboarding } from "@/components/onboarding/WorkspaceOnboarding";

export default function NewWorkspacePage() {
  return (
    <WorkspaceOnboarding
      embedded
      onCreated={() => {
        window.location.href = "/today";
      }}
    />
  );
}

