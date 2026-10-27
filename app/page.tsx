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
