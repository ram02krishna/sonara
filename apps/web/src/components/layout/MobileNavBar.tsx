"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, Library, BarChart2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function MobileNavBar() {
  const pathname = usePathname();

  const navItems = [
    { label: "Home", href: "/", icon: Home },
    { label: "Search", href: "/search", icon: Search },
    { label: "Library", href: "/library", icon: Library },
    { label: "Stats", href: "/stats", icon: BarChart2 },
  ];

  return (
    <nav className="md:hidden fixed bottom-16 left-0 right-0 z-30 px-4 py-2 pointer-events-none">
      <div className="glass-panel border border-foreground/10 rounded-2xl flex items-center justify-around py-2 shadow-2xl backdrop-blur-xl pointer-events-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-1 text-[11px] font-medium transition-colors",
                isActive ? "text-cyan-600 dark:text-cyan-400 font-semibold" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
