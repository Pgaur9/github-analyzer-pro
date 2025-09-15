export default function Page() {
  return (
    <div className="space-y-8">
      <section className="space-y-4 pt-8">
        <h1 className="hero">What to Build · Analyzer</h1>
        <p className="hero-sub">
          Generate polished READMEs, inspect repositories, and open PRs in one place.
        </p>
      </section>

      <div className="grid sm:grid-cols-2 gap-6">
        <a className="card-lg hover:bg-white/[0.08] transition-colors" href="/readme">
          <h2 className="text-xl font-semibold mb-2">README Generator →</h2>
          <p className="text-white/70">Analyze a repository and draft a professional README in minutes.</p>
        </a>
        <a className="card-lg hover:bg-white/[0.08] transition-colors" href="/analyzer">
          <h2 className="text-xl font-semibold mb-2">Analyzer & Security →</h2>
          <p className="text-white/70">Get quick insights and fetch Dependabot and Code Scanning alerts.</p>
        </a>
      </div>
    </div>
  );
}