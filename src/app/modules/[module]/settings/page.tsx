"use client";
import { useParams, notFound } from "next/navigation";
import { ModuleShell } from "@/components/Shell";
import { bySlug } from "@/lib/modules";
import Stub from "@/components/Stub";
export default function Page() {
  const slug = String(useParams().module);
  const mod = bySlug(slug);
  if (!mod) return notFound();
  return (
    <ModuleShell slug={slug} title={`${mod.label} - Settings`}>
      <Stub title="Settings" note="Part of the MP Performance reference build in Phase 2, then cloned to every module." />
    </ModuleShell>
  );
}
