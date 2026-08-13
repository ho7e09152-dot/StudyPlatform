import Link from "next/link";
import { LegalBackLink } from "@/components/legal/LegalBackLink";

interface LegalSection {
  title: string;
  paragraphs: string[];
}

export function LegalDocumentPage({
  title,
  effectiveDate,
  returnTo,
  sections,
}: {
  title: string;
  effectiveDate: string;
  returnTo: string;
  sections: LegalSection[];
}) {
  return (
    <main className="legal-page">
      <div className="legal-page__frame">
        <header className="legal-page__topbar">
          <LegalBackLink fallback={returnTo} />
          <Link className="legal-brand" href="/" aria-label="Study-ing 홈">Study-ing</Link>
        </header>

        <article className="legal-document">
          <header>
            <span>Study-ing 정책</span>
            <h1>{title}</h1>
            <p>시행일 · {effectiveDate}</p>
          </header>

          <div className="legal-document__body">
            {sections.map((section) => (
              <section key={section.title}>
                <h2>{section.title}</h2>
                {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </section>
            ))}
          </div>

        </article>

        <footer className="legal-page__footer">
          <Link href="/">홈</Link>
          <Link href="/terms?returnTo=/">이용약관</Link>
          <Link href="/privacy?returnTo=/">개인정보 처리 안내</Link>
        </footer>
      </div>
    </main>
  );
}
