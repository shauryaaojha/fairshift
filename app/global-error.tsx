'use client';

/** Last-resort boundary when the root layout itself fails. It must render its own <html>. */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: 24, background: '#f2f3ee' }}>
        <main role="alert" style={{ maxWidth: 480, margin: '15vh auto' }}>
          <h1 style={{ fontSize: 28, color: '#1c1d1a' }}>FairShift could not load</h1>
          <p style={{ fontSize: 18, lineHeight: 1.6, color: '#1c1d1a' }}>
            Please try again. Entries saved on this phone are kept and will sync later.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              minHeight: 48,
              padding: '0 20px',
              fontSize: 18,
              fontWeight: 600,
              color: '#fff',
              background: '#1f3fb5',
              border: 0,
              borderRadius: 10,
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
