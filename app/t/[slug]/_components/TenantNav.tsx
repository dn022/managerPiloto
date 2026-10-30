"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

export type NavItem = { href: string; label: string };
export type NavSection = { title: string | null; items: NavItem[] };

export default function TenantNav({ sections }: { sections: NavSection[] }) {
  const pathname = usePathname();
  const tabsRef = useRef<HTMLDivElement>(null);

  const isActive = (href: string) =>
    pathname === href || (href.split("/").length > 3 && pathname.startsWith(`${href}/`));

  // No celular o item ativo fica visível na faixa de abas.
  useEffect(() => {
    tabsRef.current?.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView({
      inline: "center",
      block: "nearest",
    });
  }, [pathname]);

  return (
    <>
      <nav className="arena-nav glass hidden space-y-6 rounded-2xl border p-3 text-sm md:block">
        {sections.map((section) => (
          <div key={section.title ?? "root"}>
            {section.title && (
              <div className="mb-2 px-3 text-xs uppercase tracking-wider text-zinc-500">{section.title}</div>
            )}
            <ul className="space-y-1">
              {section.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`block rounded-lg px-3 py-2 ${
                        active ? "text-white" : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100"
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <nav ref={tabsRef} className="arena-tabs glass border-y md:hidden" aria-label="Seções">
        {sections.map((section, i) => (
          <div key={section.title ?? "root"} className="flex flex-none items-center gap-1.5">
            {i > 0 && <span className="arena-tabs-sep" aria-hidden />}
            {section.items.map((item) => (
              <Link key={item.href} href={item.href} aria-current={isActive(item.href) ? "page" : undefined}>
                {item.label}
              </Link>
            ))}
          </div>
        ))}
      </nav>
    </>
  );
}
