import Link from 'next/link';
import { StitchIllustration } from '@/components/stitch/stitch-illustration';
import { Logo } from '@/components/shell/logo';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <aside className="relative hidden overflow-hidden bg-rail text-rail-foreground lg:flex lg:flex-col">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(120% 80% at 0% 0%, rgba(74,87,168,0.55) 0%, transparent 55%), radial-gradient(90% 70% at 100% 100%, rgba(242,179,61,0.12) 0%, transparent 60%)',
          }}
        />
        <div className="relative flex flex-1 flex-col justify-between p-12 xl:p-16">
          <Link href="/login" className="w-fit rounded-md focus-visible:ring-2 focus-visible:ring-marigold">
            <Logo tone="light" />
          </Link>

          <div className="max-w-xl">
            <p className="text-[clamp(2rem,3.2vw,3rem)] font-semibold leading-[1.05] tracking-[-0.02em] text-white">
              Every working day is a stitch.
            </p>
            <p className="mt-4 max-w-md text-lg leading-relaxed text-rail-muted">
              Check in with one tap, apply for leave with the day count in front of you, and read your whole month at a
              glance.
            </p>
            <StitchIllustration className="mt-12 w-full max-w-xl" />
            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-rail-muted">
              {[
                ['var(--present)', 'Present'],
                ['var(--late)', 'Late'],
                ['var(--absent)', 'Absent'],
                ['var(--leave)', 'Leave'],
                ['var(--holiday)', 'Holiday'],
              ].map(([c, l]) => (
                <span key={l} className="inline-flex items-center gap-2">
                  <span className="h-[3px] w-4 rounded-full" style={{ background: c }} />
                  {l}
                </span>
              ))}
            </div>
          </div>

          <p className="text-sm text-rail-muted">Office time · Asia/Dhaka</p>
        </div>
      </aside>

      <main className="flex min-h-dvh flex-col">
        <header className="grid gap-4 bg-rail px-4 pb-4 pt-4 lg:hidden">
          <Logo tone="light" />
          {/* The world travels to the phone too: the stitched month, cropped to a strip. */}
          <div className="h-12 overflow-hidden" aria-hidden>
            <StitchIllustration className="w-[640px] max-w-none" />
          </div>
        </header>
        <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
          <div className="w-full max-w-[26rem]">{children}</div>
        </div>
      </main>
    </div>
  );
}
