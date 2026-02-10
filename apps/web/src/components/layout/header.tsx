'use client';

import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { OrgSwitcher } from './org-switcher';
import { UserMenu } from './user-menu';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu } from 'lucide-react';
import { Sidebar } from './sidebar';

export function Header() {
  const { isAuthenticated } = useAuth();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        {/* Mobile menu */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden mr-2">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <Sidebar />
          </SheetContent>
        </Sheet>

        {/* Logo */}
        <Link href="/" className="flex items-center space-x-2 mr-6">
          <span className="font-bold text-lg">Prospector</span>
        </Link>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right side */}
        {isAuthenticated ? (
          <div className="flex items-center space-x-4">
            <OrgSwitcher />
            <UserMenu />
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            <Link href="/login">
              <Button variant="ghost">Sign in</Button>
            </Link>
            <Link href="/register">
              <Button>Sign up</Button>
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
