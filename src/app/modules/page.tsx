"use client";
import Link from "next/link";
import { OrgShell } from "@/components/Shell";
import { MODULES } from "@/lib/modules";
import { useWorkspace } from "@/lib/workspace";

export default function ModuleIndex() {
  const { projects } = useWorkspace();
  return (
    <OrgShell title="Research Modules">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {MODULES.map((m) => {
          const n = projects.filter((p) => p.project_type === m.type).length;
          return (
            <Link key={m.slug} href={`/modules/${m.slug}`}
              className="card card-accent p-6 transition hover:-translate-y-1 hover:shadow-[0_18px_48px_-20px_rgba(11,38,71,.28)]">
              <div className="flex items-center gap-3 mb-3">
                <span className="w-12 h-12 rounded-full grid place-items-center border-2 font-display font-bold text-[15px]"
                  style={{ borderColor: m.colour, color: m.colour, background: "#fff" }}>{m.short}</span>
                <span className="mono text-[11px] text-muted-2">{n} {n === 1 ? "study" : "studies"}</span>
              </div>
              <h2 className="text-[19px] font-bold text-ink mb-1.5">{m.label}</h2>
              <p className="text-[13px] text-muted leading-relaxed">{m.blurb}</p>
            </Link>
          );
        })}
      </div>
    </OrgShell>
  );
}
