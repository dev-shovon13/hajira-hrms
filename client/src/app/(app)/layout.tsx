import { Sidebar, MobileNav } from '@/components/shell/sidebar';
import { Topbar } from '@/components/shell/topbar';
import { CommandMenu } from '@/components/shell/command-menu';
import { DeniedNotice } from '@/components/shell/denied-notice';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      <Sidebar />
      <MobileNav />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main id="main" className="mx-auto w-full max-w-[1400px] flex-1 px-4 pb-16 pt-6 sm:px-6 lg:px-8 lg:pt-8">
          {children}
        </main>
      </div>
      <CommandMenu />
      <DeniedNotice />
    </div>
  );
}
