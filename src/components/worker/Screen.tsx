import type { ReactNode } from 'react';
import { TopBar } from '@/src/components/ui/TopBar';

type ScreenProps = {
  title: string;
  speakText: string;
  backLabel: string;
  backHref?: string | null;
  transitionName?: string;
  /** The one primary action, pinned to the thumb zone. */
  action?: ReactNode;
  children: ReactNode;
};

/** Common frame: top bar, content, then one full-width action at the bottom. */
export function Screen({
  title,
  speakText,
  backLabel,
  backHref,
  transitionName,
  action,
  children,
}: ScreenProps) {
  return (
    <div className="flex flex-1 flex-col">
      <TopBar
        title={title}
        speakText={speakText}
        backLabel={backLabel}
        backHref={backHref}
        transitionName={transitionName}
      />
      <div className="flex flex-1 flex-col gap-4 px-4 pb-4 pt-2">{children}</div>
      {action ? (
        <div className="screen-action sticky bottom-0 bg-paper px-4 pb-3 pt-2">{action}</div>
      ) : null}
    </div>
  );
}
