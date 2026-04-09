"use client";

import { useState, useSyncExternalStore } from "react";
import Image from "next/image";
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
import { Menu, Search } from "lucide-react";
import { Sidebar } from "./sidebar";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { ThemeToggle } from "./theme-toggle";
import { useCommandPalette } from "@/components/command-palette/command-palette";
import { modifierSymbol } from "@/lib/platform";

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

// SSR-safe platform detection via useSyncExternalStore
const subscribe = () => () => {};
const getSnapshot = () => modifierSymbol();
const getServerSnapshot = () => "Ctrl";

function CommandPaletteTrigger() {
  const { setOpen } = useCommandPalette();
  const mod = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <Button
      variant="outline"
      size="sm"
      className="hidden md:flex items-center gap-2 text-muted-foreground"
      onClick={() => setOpen(true)}
    >
      <Search className="h-4 w-4" />
      <span className="text-xs">{mod}K</span>
    </Button>
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
        <Link href="/" className="mr-6" aria-label="Colophony home">
          <Image
            src="/logos/logotype-light.svg"
            alt="Colophony"
            width={120}
            height={24}
            className="hidden dark:block"
            priority
          />
          <Image
            src="/logos/logotype-dark.svg"
            alt="Colophony"
            width={120}
            height={24}
            className="block dark:hidden"
            priority
          />
        </Link>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right side */}
        {isAuthenticated ? (
          <div className="flex items-center space-x-4">
            <CommandPaletteTrigger />
            <ThemeToggle />
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
