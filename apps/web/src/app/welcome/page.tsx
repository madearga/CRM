import Link from 'next/link';

const facts = [
  ['Pipeline', 'Prospek'],
  ['Relasi', 'Perusahaan'],
  ['Dokumen', 'Invoice'],
];

export default function WelcomePage() {
  return (
    <main className="flex min-h-dvh flex-col px-6 py-8 sm:px-10 sm:py-10">
      <header>
        <span className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Ruang
        </span>
      </header>

      <div className="flex flex-1 items-center py-16">
        <div className="w-full max-w-xl">
          <h1 className="text-balance text-4xl font-medium tracking-tight text-foreground sm:text-5xl">
            Ruang kerja untuk orang dan agen.
          </h1>
          <p className="mt-5 max-w-md text-pretty text-base leading-relaxed text-muted-foreground">
            Satu tempat untuk pipeline, klien, dan pekerjaan harian. Tanpa tab
            yang berserakan, tanpa data yang tertinggal.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-4">
            <Link
              href="/login"
              className="inline-flex h-10 items-center rounded-md px-5 text-sm font-medium transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none" style={{ backgroundColor: '#f0f0fa', color: '#0b0b10', boxShadow: '0 1px 2px rgba(0,0,0,0.4)' }}
            >
              Masuk
            </Link>
            <span className="text-sm text-muted-foreground">
              Akses dengan undangan dari tim.
            </span>
          </div>

          <dl className="mt-16 grid max-w-lg grid-cols-3 gap-5 border-t border-border pt-6">
            {facts.map(([label, value]) => (
              <div key={label}>
                <dt className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  {label}
                </dt>
                <dd className="mt-1 text-sm text-foreground">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <footer className="flex w-full max-w-xl items-center justify-between text-xs text-muted-foreground">
        <span>&copy; {new Date().getFullYear()} Ruang</span>
        <span className="font-mono uppercase tracking-[0.14em]">Privat</span>
      </footer>
    </main>
  );
}
