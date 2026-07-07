// Static legal pages (backlog #19). Plain, calm prose per voice.md — no wit in
// legal copy. Content matches what the app actually collects/does; update these
// pages when that changes (e.g. analytics, new data sources, monetization).

import { Link } from "react-router-dom";

const LAST_UPDATED = "July 6, 2026";

function LegalShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="max-w-2xl mx-auto">
      <p className="text-sm text-dim mb-4">
        <Link to="/" className="hover:text-accent transition-colors">← home</Link>
      </p>
      <h1 className="text-2xl font-semibold mb-1">{title}</h1>
      <p className="text-xs text-dim mb-8">Last updated: {LAST_UPDATED}</p>
      <div className="space-y-6 text-sm leading-relaxed [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mb-1.5 [&_p]:text-ink/90 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_ul]:text-ink/90">
        {children}
      </div>
    </div>
  );
}

export function TermsPage() {
  return (
    <LegalShell title="Terms of Use">
      <section>
        <h2>Not financial advice</h2>
        <p>
          Bellwether is provided for informational and educational purposes only.
          Nothing on this site constitutes financial, investment, tax, or trading
          advice, or a recommendation to buy, sell, or hold any security. Scores and
          signals are generated algorithmically from publicly available data and
          reflect no knowledge of your circumstances. Always do your own research or
          consult a licensed financial advisor before making investment decisions.
        </p>
      </section>
      <section>
        <h2>No warranty on data</h2>
        <p>
          Market data is sourced from third-party providers, may be delayed
          (typically 15 minutes or more), and may be incomplete or inaccurate.
          Scores are cached and can lag current market conditions. The service is
          provided "as is", without warranty of any kind — we make no guarantee of
          accuracy, availability, or fitness for any purpose, and accept no
          liability for decisions made based on it.
        </p>
      </section>
      <section>
        <h2>Acceptable use</h2>
        <p>
          Personal, non-commercial use only. Don't scrape, bulk-download, or
          redistribute data from the site or its API; don't attempt to disrupt the
          service or access other users' data. We may suspend access that violates
          these terms.
        </p>
      </section>
      <section>
        <h2>Your account</h2>
        <p>
          You can use Bellwether as a guest or with an account. You can delete your
          account and all associated data at any time from the profile page. We may
          modify or discontinue the service at any time — it's a free personal
          project, offered without service-level commitments.
        </p>
      </section>
      <section>
        <h2>Changes</h2>
        <p>
          We may update these terms; the "Last updated" date above reflects the
          current version. Continued use after a change means you accept the updated
          terms. Questions? Use the feedback link in the footer.
        </p>
      </section>
      <p className="text-dim">
        See also: <Link to="/legal/privacy" className="text-accent hover:underline">Privacy Policy</Link>.
      </p>
    </LegalShell>
  );
}

export function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy">
      <section>
        <h2>What we collect</h2>
        <ul>
          <li>
            <strong>Guests:</strong> a random session identifier stored in your
            browser, plus the watchlists you create. Guest data expires
            automatically after 7 days of inactivity. No email, no name.
          </li>
          <li>
            <strong>Accounts:</strong> your email address (via AWS Cognito, used for
            sign-in and verification only), optionally the name you choose to be
            addressed by, and your watchlists.
          </li>
          <li>
            <strong>Nothing else:</strong> no advertising trackers, no analytics
            cookies, no sale or sharing of personal data. Standard server logs
            (IP address, request path) exist for operation and security and are
            retained briefly by the hosting platform.
          </li>
        </ul>
      </section>
      <section>
        <h2>Where it lives</h2>
        <p>
          Data is stored on Amazon Web Services in the United States (us-east-1):
          watchlists and profile names in DynamoDB, sign-in credentials in AWS
          Cognito. Market data shown to you comes from third-party providers (Yahoo
          Finance); your watchlist contents are used to fetch quotes but are not
          shared with anyone.
        </p>
      </section>
      <section>
        <h2>Third-party services</h2>
        <p>
          The "Report a bug / request a feature" form is provided by Tally
          (tally.so); anything you submit there is processed under Tally's privacy
          policy. Signing in uses AWS Cognito's hosted pages.
        </p>
      </section>
      <section>
        <h2>Deleting your data</h2>
        <p>
          Signed-in users can delete their account — including all watchlists,
          profile data, and the sign-in identity — in one step from the profile
          page. Guest data expires automatically. For anything else, reach out via
          the feedback link in the footer.
        </p>
      </section>
      <section>
        <h2>Changes</h2>
        <p>
          If what we collect or where it lives changes, this page changes with it —
          check the "Last updated" date above.
        </p>
      </section>
      <p className="text-dim">
        See also: <Link to="/legal/terms" className="text-accent hover:underline">Terms of Use</Link>.
      </p>
    </LegalShell>
  );
}
