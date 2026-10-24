"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Home, Library, Search, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/search", label: "Search", icon: Search },
  { href: "/library", label: "Library", icon: Library },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function MobileNavBar() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="md:hidden fixed bottom-0 inset-x-0 z-40 glass-panel border-t border-foreground/10 pb-[env(safe-area-inset-bottom)]">
      <ul className="flex justify-around py-1.5">
        {TABS.map(({ href, label, icon: Icon }) => {
          const on = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link href={href} aria-current={on ? "page" : undefined} className={cn("flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] font-medium", on ? "text-primary" : "text-muted-foreground")}>
                <Icon className="w-5 h-5" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
