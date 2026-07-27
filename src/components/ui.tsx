"use client";
import Link from "next/link";

export function ExecKpi({ k, v, s, tone = "" }: { k: string; v: string | number; s?: string; tone?: string }) {
  const bar = tone === "b" ? "bg-blue" : tone === "g" ? "bg-lime" : tone === "w" ? "bg-gold" : tone === "r" ? "bg-signal" : "bg-lime";
  return (
    <div className="relative overflow-hidden bg-surface border border-line rounded-[14px] p-4 shadow-card">
      <span className={`absolute top-0 left-0 right-0 h-[3px] ${bar}`} />
      <div className="mono text-[9.5px] tracking-wide uppercase text-muted-2">{k}</div>
      <div className="font-display text-[27px] font-extrabold text-ink mt-1.5 leading-none">{v}</div>
      {s && <div className="text-[11px] text-muted mt-1.5">{s}</div>}
    </div>
  );
}

export function Block({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-line rounded-xl2 p-5 shadow-card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[19px] font-bold text-ink">{title}</h2>
        {right}
      </div>
      {children}
    </div>
  );
}

export function QuickAction({ href, label, badge, colour }: { href: string; label: string; badge: string; colour: string }) {
  return (
    <Link href={href}
      className="relative flex items-center gap-3 p-3.5 border border-line rounded-xl2 font-semibold text-[14px] bg-surface overflow-hidden transition hover:-translate-y-0.5 hover:border-lime hover:shadow-card group">
      <span className="absolute top-0 left-0 right-0 h-[3px] bg-lime scale-x-0 origin-left transition group-hover:scale-x-100" />
      <span className="w-[38px] h-[38px] rounded-full grid place-items-center text-white font-display font-bold text-[15px] border-2 border-white/50 flex-shrink-0"
        style={{ background: colour }}>{badge}</span>
      {label}
    </Link>
  );
}
