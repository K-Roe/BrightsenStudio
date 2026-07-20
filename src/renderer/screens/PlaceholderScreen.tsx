import type { ReactElement } from 'react';

interface PlaceholderScreenProps {
  title: string;
  eyebrow: string;
  summary: string;
}

export function PlaceholderScreen({ title, eyebrow, summary }: PlaceholderScreenProps): ReactElement {
  return (
    <main className="screen">
      <section className="placeholder-band">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{summary}</p>
      </section>
    </main>
  );
}
