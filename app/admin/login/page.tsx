import { LoginForm } from '@/src/components/admin/LoginForm';
import { LineReveal } from '@/src/components/motion/LineReveal';

export const metadata = { title: 'Sign in | FairShift console' };

export default function AdminLoginPage() {
  return (
    <div className="login-page">
      <div className="login-sheet">
        <LineReveal as="h1" className="page-title" immediate>
          Supervisor sign in
        </LineReveal>
        <p className="page-sub">See who is on site, which hazards are late and who may leave.</p>
        <LoginForm />
        <div className="demo-box">
          <p>
            <strong>Demo accounts</strong> (seeded data, not real people):
          </p>
          <p className="mono">admin.skyline@fairshift.org</p>
          <p className="mono">admin.campus@fairshift.org</p>
          <p>
            Password <span className="mono">Admin@1234</span>
          </p>
        </div>
      </div>
    </div>
  );
}
