import Link from 'next/link';
import type { ActionItem } from '@/src/server/services/adminRows';

/** The supervisor's to-do list: one row per kind of work waiting, with its count. */
export function NeedsAction({ items }: { items: ActionItem[] }) {
  return (
    <section className="section" aria-labelledby="needs-h">
      <h2 id="needs-h" className="section-title">
        Needs action
      </h2>
      {items.length === 0 ? (
        <p className="text-body">Nothing is waiting on you right now.</p>
      ) : (
        <ul className="needs">
          {items.map((item) => (
            <li key={item.key}>
              <Link href={item.href} data-urgent={item.urgent || undefined}>
                <span className="needs-count mono">{item.count}</span>
                <span>
                  <strong>{item.label}</strong>
                  <span className="text-small muted needs-detail">{item.detail}</span>
                </span>
                <span className="needs-go" aria-hidden="true">
                  ›
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
