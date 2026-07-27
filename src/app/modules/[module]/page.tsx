"use client";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ModuleShell } from "@/components/Shell";
import { bySlug, MODULE_NAV } from "@/lib/modules";
import { useWorkspace } from "@/lib/workspace";
import { notFound } from "next/navigation";

export default function ModuleHome() {
  const params = useParams();
  const slug = String(params.module);
  const mod = bySlug(slug);
  const { projects } = useWorkspace();
  if (!mod) return notFound();
  const studies = projects.filter((p) => p.project_type === mod.type);

  return (
    <ModuleShell slug={slug} title={`${mod.label} - Home`}>
      <div className="relative overflow-hidden rounded-[18px] p-8 text-white mb-6"
        style={{ background: `linear-gradient(115deg, ${mod.colour} 0%, #0B2647 130%)` }}>
        <h1 className="text-[30px] font-extrabold mb-1.5">{mod.label}</h1>
        <p className="mono text-[13px] text-white/80">{studies.length} {studies.length === 1 ? "study" : "studies"} in this module</p>
      </div>

      <div className="bg-surface border border-line rounded-xl2 p-6 shadow-card card-accent mb-5">
        <div className="kicker mb-2">Phase 2</div>
        <h2 className="text-[20px] font-bold text-ink mb-2">Module workspace under construction</h2>
        <p className="text-muted text-[14px] max-w-xl">
          This is the reference module workspace. Its Home, Studies, Dashboard, Builder, Collect, Reports,
          Team and Settings pages are built here first, then cloned to the other five modules.
        </p>
        <div className="flex flex-wrap gap-2 mt-4">
          {MODULE_NAV.filter((n) => n.seg).map((n) => (
            <Link key={n.key} href={`/modules/${slug}/${n.seg}`}
              className="btn-ghost btn h-9 px-3 text-[13px]">{n.label}</Link>
          ))}
        </div>
      </div>
    </ModuleShell>
  );
}
