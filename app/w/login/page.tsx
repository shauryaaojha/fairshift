import { LanguageGate } from "@/src/components/worker/LanguageGate";
import { LoginForm } from "@/src/components/worker/LoginForm";
import { TopBar } from "@/src/components/ui/TopBar";
import { DEFAULT_LOCALE, t } from "@/src/i18n";
import { getLocale } from "@/src/server/services/workerUi";

export default async function WorkerLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const [{ lang }, locale] = await Promise.all([searchParams, getLocale()]);
  // First visit (no language cookie) or "Change language": show the gate.
  if (!locale || lang === "1") {
    return <LanguageGate current={locale ?? DEFAULT_LOCALE} next="/w/login" />;
  }
  return (
    <div className="flex flex-1 flex-col">
      <TopBar
        title={t(locale, "login.title")}
        speakText={t(locale, "login.speak")}
        backLabel={t(locale, "common.back")}
        backHref="/w/login?lang=1"
      />
      <LoginForm />
    </div>
  );
}
