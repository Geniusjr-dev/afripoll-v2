"use client";
import { OrgSidebar, ModuleSidebar } from "./Sidebar";

function TopStrip({ title }: { title: string }) {
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return (
    <div className="flex items-center justify-between gap-3 px-8 py-3.5 bg-surface border-b border-line sticky top-0 z-20">
      <span className="font-display font-bold text-[16px] text-ink">{title}</span>
      <span className="mono text-[12.5px] text-muted">{today}</span>
    </div>
  );
}

export function OrgShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <OrgSidebar />
      <div className="ml-64 min-h-screen flex flex-col">
        <TopStrip title={title} />
        <div className="p-8 max-w-[1240px] w-full">{children}</div>
      </div>
    </div>
  );
}

export function ModuleShell({ slug, title, children }: { slug: string; title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <ModuleSidebar slug={slug} />
      <div className="ml-64 min-h-screen flex flex-col">
        <TopStrip title={title} />
        <div className="p-8 max-w-[1240px] w-full">{children}</div>
      </div>
    </div>
  );
}
