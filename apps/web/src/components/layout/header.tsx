"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { OrgSwitcher } from "./org-switcher";
import { UserMenu } from "./user-menu";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { Sidebar } from "./sidebar";
import { NotificationBell } from "@/components/notifications/notification-bell";

/** Keyed by pathname — remounts on navigation to auto-close the sheet. */
function MobileMenu() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden mr-2">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <Sidebar />
      </SheetContent>
    </Sheet>
  );
}

export function Header() {
  const { isAuthenticated, login } = useAuth();
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        {/* Mobile menu — key resets state on navigation */}
        <MobileMenu key={pathname} />

        {/* Logo */}
        <Link href="/" className="flex items-center space-x-2 mr-6">
          <span className="font-bold text-lg">Colophony</span>
        </Link>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right side */}
        {isAuthenticated ? (
          <div className="flex items-center space-x-4">
            <OrgSwitcher />
            <NotificationBell />
            <UserMenu />
          </div>
        ) : (
          <Button variant="ghost" onClick={login}>
            Sign in
          </Button>
        )}
      </div>
    </header>
  );
}
