import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MusicDNA — a catalog of revealing decisions" },
      {
        name: "description",
        content:
          "Most music apps measure what you listen to. MusicDNA measures what you choose under constraint. Begin a short ritual of forced choices and see what your taste reveals.",
      },
      { property: "og:title", content: "MusicDNA" },
      {
        property: "og:description",
        content:
          "Music is the language. Identity is the destination.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <Nav />
      <Hero />
      <Manifesto />
      <Layers />
      <CTA />
      <Footer />
    </main>
  );
}

function Nav() {
  return (
    <header className="border-b hairline">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link to="/" className="flex items-center gap-2">
          <Mark />
          <span className="font-mono text-xs tracking-[0.22em] uppercase text-foreground">
            MusicDNA
          </span>
        </Link>
        <nav className="flex items-center gap-6">
          <Link
            to="/"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Thesis
          </Link>
          <Link
            to="/"
            hash="layers"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            How it works
          </Link>
          <Link
            to="/auth"
            className="inline-flex items-center gap-2 rounded-sm border hairline-strong px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-secondary"
          >
            Begin
            <ArrowRight />
          </Link>
        </nav>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="border-b hairline">
      <div className="mx-auto max-w-6xl px-6 pt-24 pb-28">
        <p className="eyebrow mb-8">A new kind of music product · V0</p>
        <h1 className="display text-5xl text-foreground sm:text-7xl md:text-[5.5rem]">
          We are not building <br />
          a catalog of songs. <br />
          <span className="italic text-muted-foreground">
            We are building a catalog of revealing decisions.
          </span>
        </h1>
        <div className="mt-12 grid grid-cols-1 gap-10 md:grid-cols-12">
          <p className="md:col-span-7 md:col-start-1 text-lg leading-relaxed text-muted-foreground">
            Spotify measures listening. MusicDNA measures decision-making.
            Listening is consumption. Choosing under constraint reveals values.
            What you choose, when you can only choose one, is who you are.
          </p>
          <div className="md:col-span-4 md:col-start-9 flex flex-col items-start gap-4">
            <Link
              to="/auth"
              className="group inline-flex items-center gap-3 rounded-sm bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-all hover:opacity-90"
            >
              Begin your MusicDNA
              <ArrowRight />
            </Link>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              ~3 minutes · 20 choices · 1 reading
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Manifesto() {
  const rows = [
    {
      a: "Spotify knows",
      b: "Alan listened to Ceremony 72 times.",
      tone: "muted",
    },
    {
      a: "MusicDNA knows",
      b: "Alan chose Ceremony over Dreaming of Me, Never Let Me Down Again, Blue Monday, and The Killing Moon.",
      tone: "primary",
    },
  ];
  return (
    <section className="border-b hairline">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <p className="eyebrow mb-10">The core principle</p>
        <div className="space-y-px overflow-hidden rounded-sm border hairline">
          {rows.map((row, i) => (
            <div
              key={i}
              className="grid grid-cols-1 gap-2 bg-surface px-6 py-8 md:grid-cols-12 md:gap-8"
            >
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground md:col-span-3 md:pt-1">
                {row.a}
              </p>
              <p
                className={
                  "md:col-span-9 font-serif text-2xl leading-snug md:text-3xl " +
                  (row.tone === "primary"
                    ? "text-foreground"
                    : "text-muted-foreground")
                }
              >
                {row.b}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-10 max-w-2xl text-sm text-muted-foreground">
          Those are fundamentally different signals. One tracks consumption.
          The other measures preference under constraint — the closest thing
          we have to revealed values.
        </p>
      </div>
    </section>
  );
}

function Layers() {
  const layers = [
    {
      n: "01",
      kicker: "Conversational discovery",
      title: "Tell me five songs you love.",
      body: "The system reads them as a hypothesis. \"You seem to favor movement, atmosphere, and emotional lift over melody and lyrical cleverness. Let's test that.\"",
    },
    {
      n: "02",
      kicker: "Diagnostic matchups",
      title: "Choose one.",
      body: "Each pair is built to probe a latent dimension. Temptation vs This Charming Man tests groove against verbal precision. Every matchup must answer one question — what are we testing? — or it doesn't exist.",
    },
    {
      n: "03",
      kicker: "Interpretation",
      title: "Here is what your choices reveal.",
      body: "Not \"you like alternative rock.\" Instead: you consistently reward movement over polish, atmosphere over verbal cleverness, transformation over nostalgia. The reading should feel annoyingly accurate.",
    },
  ];
  return (
    <section id="layers" className="border-b hairline">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <p className="eyebrow mb-10">Three layers</p>
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-sm border hairline md:grid-cols-3">
          {layers.map((l) => (
            <article
              key={l.n}
              className="flex flex-col gap-6 bg-surface p-8 md:p-10"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-muted-foreground">
                  {l.n}
                </span>
                <span className="eyebrow">{l.kicker}</span>
              </div>
              <h3 className="display text-2xl text-foreground md:text-[1.75rem]">
                {l.title}
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {l.body}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="border-b hairline">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <div className="grid grid-cols-1 items-end gap-10 md:grid-cols-12">
          <div className="md:col-span-8">
            <p className="eyebrow mb-6">North star</p>
            <h2 className="display text-4xl text-foreground md:text-5xl">
              People do not return because they want more songs. <br />
              <span className="italic text-muted-foreground">
                They return because they want more insight.
              </span>
            </h2>
          </div>
          <div className="md:col-span-4 md:text-right">
            <Link
              to="/auth"
              className="inline-flex items-center gap-3 rounded-sm bg-primary px-6 py-4 text-base font-medium text-primary-foreground transition-all hover:opacity-90"
            >
              Begin
              <ArrowRight />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer>
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-8">
        <div className="flex items-center gap-3">
          <Mark small />
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            MusicDNA · v0 · 2026
          </span>
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          Music is the language. Identity is the destination.
        </p>
      </div>
    </footer>
  );
}

function Mark({ small = false }: { small?: boolean }) {
  const size = small ? 14 : 18;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="6" cy="10" r="2" fill="currentColor" />
      <circle cx="14" cy="10" r="2" fill="currentColor" />
      <path
        d="M6 10c4-6 4 12 8 0"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ArrowRight() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M2 7h10m0 0L7.5 2.5M12 7l-4.5 4.5"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
