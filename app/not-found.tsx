import Link from 'next/link';
import { buttonClasses } from '@/src/components/ui/Button';

export default function NotFound() {
  return (
    <section className="mx-auto flex w-full max-w-[480px] flex-1 flex-col justify-center gap-4 px-4 py-12">
      <p className="text-small text-muted">404</p>
      <h1 className="text-h1">This page is not on the roster</h1>
      <p className="text-body">The link may be old, or the record was removed.</p>
      <div className="flex flex-wrap gap-3">
        <Link href="/w" className={buttonClasses('primary')}>
          Worker app
        </Link>
        <Link href="/admin" className={buttonClasses('secondary')}>
          Supervisor console
        </Link>
      </div>
    </section>
  );
}
