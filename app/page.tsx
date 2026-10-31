import Image from 'next/image';
import Link from 'next/link';
import { ShiftIntro } from '@/src/components/motion/ShiftIntro';
import { BroomIcon, HardHatIcon } from '@/src/components/icons';
import { InstallButton } from '@/src/components/pwa/InstallButton';

export default function LandingPage() {
  return (
    <ShiftIntro>
      <div className="landing">
        <p className="landing-mark">FairShift</p>

        <section aria-labelledby="landing-title">
          <h1 id="landing-title" className="landing-h1" data-split="">
            Fair pay. Safe sites. A voice that counts.
          </h1>
          <p className="landing-lede" data-fade="">
            FairShift is the honest version of the paper muster roll: a phone-first record of hours,
            pay and safety, in the worker&apos;s own language, with an early warning for the
            employer.
          </p>
        </section>

        <nav aria-label="Choose your role" className="role-pair" data-fade="">
          <Link href="/w" className="role role-worker">
            <span className="role-title">I work on a shift</span>
            <span className="role-sub">Check in, read your payslip, report a hazard.</span>
          </Link>
          <Link href="/admin" className="role">
            <span className="role-title">I manage a team</span>
            <span className="role-sub">See who is on site, open hazards and who may leave.</span>
          </Link>
        </nav>

        <InstallButton
          label="Add FairShift to your home screen"
          iosHint="On iPhone: tap Share, then Add to Home Screen."
          className="landing-install"
        />

        <section aria-labelledby="look-title" className="product" data-fade="">
          <h2 id="look-title" className="sr-only">
            What it looks like
          </h2>
          <figure className="product-console">
            <Image
              src="/shots/console.webp"
              alt="The supervisor console: today's attendance and a list of what needs action, most urgent first."
              width={1200}
              height={750}
              sizes="(min-width: 768px) 760px, 100vw"
            />
          </figure>
          <figure className="product-phone">
            <Image
              src="/shots/worker-ta.webp"
              alt="The worker app in Tamil: today's shift ticket with time on site and the check-in stamp."
              width={540}
              height={959}
              sizes="(min-width: 768px) 260px, 60vw"
            />
          </figure>
        </section>

        <ul className="proof" aria-label="Why it works on a real site" data-fade="">
          <li>
            <strong>Hindi, Tamil, English</strong>
            <span>Every screen in the worker&apos;s language, and read aloud.</span>
          </li>
          <li>
            <strong>Works with no signal</strong>
            <span>
              Check-ins, hazards and feedback wait on the phone and sync with the real time.
            </span>
          </li>
          <li>
            <strong>Records that hold up</strong>
            <span>Each shift is sealed with a receipt a labour officer can check by QR.</span>
          </li>
        </ul>

        <section aria-labelledby="demo-title" className="demo-box" data-fade="">
          <h2 id="demo-title" className="demo-title">
            Try the demo
          </h2>
          <dl className="demo-list">
            <div>
              <dt>
                <Link href="/w/login" className="link">
                  Worker app
                </Link>
              </dt>
              <dd>
                Phone <span className="text-mono">9876543210</span> (Hindi) or{' '}
                <span className="text-mono">9123456789</span> (Tamil), PIN{' '}
                <span className="text-mono">1234</span>
              </dd>
            </div>
            <div>
              <dt>
                <Link href="/admin/login" className="link">
                  Supervisor console
                </Link>
              </dt>
              <dd>
                <span className="text-mono">admin.regional@fairshift.org</span>, password{' '}
                <span className="text-mono">Admin@1234</span>
              </dd>
            </div>
          </dl>
          <p className="text-small text-muted">Seeded demo data. Nothing here is a real person.</p>
        </section>

        <section className="sector-strip" aria-label="Where it runs" data-fade="">
          <p>One app, two workplaces.</p>
          <span>
            <HardHatIcon size={28} aria-hidden="true" /> A construction site
          </span>
          <span>
            <BroomIcon size={28} aria-hidden="true" /> A college campus
          </span>
        </section>
      </div>
    </ShiftIntro>
  );
}
