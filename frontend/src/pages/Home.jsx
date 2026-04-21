function Home() {
  return (
    <section className="home-page">
      <div className="hero-card">
        <span className="eyebrow">Crypto Recovery Platform</span>
        <h1>Recover stolen crypto. Fight scams.</h1>
        <p>BitAudit Forensics helps individuals and organizations investigate theft, recover funds, and build stronger defenses against crypto fraud.</p>
        <div className="hero-actions">
          <a href="/report" className="button primary">Report an Incident</a>
          <a href="/resources" className="button secondary">Learn Scam Prevention</a>
        </div>
      </div>

      <div className="feature-grid">
        <article>
          <h2>Fast incident response</h2>
          <p>Report a stolen wallet or scam immediately and our recovery specialists begin action without delay.</p>
        </article>
        <article>
          <h2>Expert recovery process</h2>
          <p>We analyze blockchain data, trace suspicious activity, and coordinate with exchanges and law enforcement.</p>
        </article>
        <article>
          <h2>Anti-scam education</h2>
          <p>Learn how to identify phishing, social engineering, and fake investment schemes before you lose assets.</p>
        </article>
      </div>
    </section>
  );
}

export default Home;
