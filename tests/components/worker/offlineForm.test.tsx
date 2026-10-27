import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/src/i18n/client';
import { en } from '@/src/i18n/en';
import { CheckinPanel } from '@/src/components/worker/CheckinPanel';
import { HazardForm } from '@/src/components/worker/HazardForm';
import { FeedbackForm } from '@/src/components/worker/FeedbackForm';
import { VoiceTextarea } from '@/src/components/worker/VoiceTextarea';
import { OfflineSync } from '@/src/components/worker/OfflineSync';
import { LogoutButton } from '@/src/components/worker/LogoutButton';
import { MemoryOutboxStore, setOutboxStoreForTesting } from '@/src/lib/offline/outbox';
import * as actions from '@/app/w/actions';

function renderWithI18n(ui: React.ReactElement) {
  return render(
    <I18nProvider locale="en" messages={en}>
      {ui}
    </I18nProvider>,
  );
}

describe('Offline forms & components', () => {
  let memoryStore: MemoryOutboxStore;

  beforeEach(() => {
    memoryStore = new MemoryOutboxStore();
    setOutboxStoreForTesting(memoryStore);
    vi.restoreAllMocks();
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  });

  describe('CheckinPanel offline', () => {
    it('automatically enqueues checkin from initialCode and shows SAVED OFFLINE stamp when offline', async () => {
      await act(async () => {
        renderWithI18n(
          <CheckinPanel
            activeSince={null}
            activeShiftId={null}
            initialCode="654321"
            workerId="worker-test-1"
          />,
        );
      });

      // Verify outbox store has the item from camera scan
      const items = await memoryStore.list('worker-test-1');
      expect(items).toHaveLength(1);
      expect(items[0].kind).toBe('checkin');
      expect(items[0].payload).toEqual({ code: '654321' });
      expect(items[0].workerId).toBe('worker-test-1');
      expect(items[0].capturedAt).toBeDefined();

      // Verify UI shows SAVED OFFLINE stamp
      expect(screen.getByText('SAVED OFFLINE')).toBeInTheDocument();
      expect(screen.getByText("Will send when you're back online")).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /back to home/i })).toBeInTheDocument();
    });

    it('enqueues checkin action when user enters code manually offline', async () => {
      renderWithI18n(
        <CheckinPanel
          activeSince={null}
          activeShiftId={null}
          initialCode={null}
          workerId="worker-test-1"
        />,
      );

      // Enter 6 digits using pin keys
      for (let i = 1; i <= 6; i++) {
        fireEvent.click(screen.getByRole('button', { name: new RegExp(`key ${i}`, 'i') }));
      }

      const submitBtn = screen.getByRole('button', { name: /check in with this code/i });
      await act(async () => {
        fireEvent.click(submitBtn);
      });

      const items = await memoryStore.list('worker-test-1');
      expect(items).toHaveLength(1);
      expect(items[0].kind).toBe('checkin');
      expect(items[0].payload).toEqual({ code: '123456' });
      expect(screen.getByText('SAVED OFFLINE')).toBeInTheDocument();
    });

    it('enqueues checkout action and shows SAVED OFFLINE stamp when offline', async () => {
      renderWithI18n(
        <CheckinPanel
          activeSince="08:00"
          activeShiftId="shift-123"
          initialCode={null}
          workerId="worker-test-1"
        />,
      );

      const checkoutBtn = screen.getByRole('button', { name: /check out/i });
      await act(async () => {
        fireEvent.click(checkoutBtn);
      });

      const items = await memoryStore.list('worker-test-1');
      expect(items).toHaveLength(1);
      expect(items[0].kind).toBe('checkout');
      expect(items[0].payload).toEqual({ shiftId: 'shift-123' });

      expect(screen.getByText('SAVED OFFLINE')).toBeInTheDocument();
      expect(screen.getByText("Will send when you're back online")).toBeInTheDocument();
    });
  });

  describe('HazardForm offline', () => {
    it('enqueues hazard report and shows SAVED OFFLINE stamp when offline', async () => {
      renderWithI18n(<HazardForm workerId="worker-test-1" />);

      // Select category "Fall risk"
      const fallBtn = screen.getByRole('radio', { name: /fall risk/i });
      fireEvent.click(fallBtn);

      // Enter description
      const textarea = screen.getByLabelText(/tell us what is wrong/i);
      fireEvent.change(textarea, { target: { value: 'Loose scaffolding on 4th floor' } });

      // Click submit
      const sendBtn = screen.getByRole('button', { name: /send danger report/i });
      await act(async () => {
        fireEvent.click(sendBtn);
      });

      const items = await memoryStore.list('worker-test-1');
      expect(items).toHaveLength(1);
      expect(items[0].kind).toBe('hazard');
      expect(items[0].payload).toMatchObject({
        category: 'Fall risk',
        description: 'Loose scaffolding on 4th floor',
        severity: 'medium',
        anonymous: false,
      });

      expect(screen.getByText('SAVED OFFLINE')).toBeInTheDocument();
      expect(screen.getByText("Will send when you're back online")).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /back to home/i })).toBeInTheDocument();
    });
  });

  describe('FeedbackForm offline', () => {
    it('enqueues feedback and shows SAVED OFFLINE stamp without leaking identity', async () => {
      renderWithI18n(<FeedbackForm workerId="worker-test-1" />);

      // Select rating for each of the 4 questions
      const radioGroups = screen.getAllByRole('radiogroup');
      expect(radioGroups).toHaveLength(4);

      for (const group of radioGroups) {
        const buttons = group.querySelectorAll('button[role="radio"]');
        fireEvent.click(buttons[3]); // Rating 4
      }

      // Enter optional comment
      const commentInput = screen.getByLabelText(/anything to add/i);
      fireEvent.change(commentInput, { target: { value: 'Great team work today' } });

      const sendBtn = screen.getByRole('button', { name: /send feedback/i });
      await act(async () => {
        fireEvent.click(sendBtn);
      });

      const items = await memoryStore.list('worker-test-1');
      expect(items).toHaveLength(1);
      expect(items[0].kind).toBe('feedback');
      // Feedback must have a random UUID id, not the worker ID
      expect(items[0].id).not.toBe('worker-test-1');
      expect(items[0].payload).toMatchObject({
        managerRespect: 4,
        safetyRating: 4,
        payFairness: 4,
        workloadRating: 4,
        comment: 'Great team work today',
      });

      expect(screen.getByText('SAVED OFFLINE')).toBeInTheDocument();
      expect(screen.getByText("Will send when you're back online")).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /back to home/i })).toBeInTheDocument();
    });
  });

  describe('VoiceTextarea offline', () => {
    it('hides mic button when offline and keeps textarea usable', () => {
      // Mock SpeechRecognition support on window
      const mockRecognition = vi.fn();
      (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = mockRecognition;

      // Online: mic button is shown
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
      const { unmount } = renderWithI18n(
        <VoiceTextarea id="test-desc" label="Description" value="Hello" onChange={vi.fn()} />,
      );
      expect(screen.getByRole('button', { name: /speak/i })).toBeInTheDocument();
      unmount();

      // Offline: mic button is hidden
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
      renderWithI18n(
        <VoiceTextarea id="test-desc" label="Description" value="Hello" onChange={vi.fn()} />,
      );
      expect(screen.queryByRole('button', { name: /speak/i })).not.toBeInTheDocument();
      const textarea = screen.getByLabelText('Description');
      expect(textarea).toBeInTheDocument();
      expect(textarea).not.toBeDisabled();
    });
  });

  describe('OfflineSync banner', () => {
    it('displays offline banner with saved count when items are queued', async () => {
      await memoryStore.put({
        id: 'q-1',
        workerId: 'w-1',
        kind: 'checkin',
        payload: { code: '123456' },
        capturedAt: new Date().toISOString(),
        attempts: 0,
      });

      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

      await act(async () => {
        renderWithI18n(<OfflineSync workerId="w-1" />);
      });

      expect(
        screen.getByText(
          'You are offline. Showing what you saw last time. 1 saved, will send when online',
        ),
      ).toBeInTheDocument();
    });

    it('syncs items when back online', async () => {
      await memoryStore.put({
        id: 'q-1',
        workerId: 'w-1',
        kind: 'checkin',
        payload: { code: '123456' },
        capturedAt: new Date().toISOString(),
        attempts: 0,
      });

      vi.spyOn(actions, 'checkInAction').mockResolvedValue({
        ok: true,
        time: '08:00',
        already: false,
        shiftId: 's-1',
      });

      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);

      await act(async () => {
        renderWithI18n(<OfflineSync workerId="w-1" />);
      });

      // Item should be flushed
      const remaining = await memoryStore.list('w-1');
      expect(remaining).toHaveLength(0);
      expect(screen.getByText('All sent')).toBeInTheDocument();
    });
  });

  describe('LogoutButton', () => {
    it('deletes fairshift-pages cache before triggering logout action', async () => {
      const deleteMock = vi.fn().mockResolvedValue(true);
      (window as unknown as { caches: { delete: unknown } }).caches = {
        delete: deleteMock,
      };

      const logoutMock = vi.spyOn(actions, 'logoutAction').mockResolvedValue(undefined as never);

      renderWithI18n(<LogoutButton label="Log out" />);

      const button = screen.getByRole('button', { name: 'Log out' });
      await act(async () => {
        fireEvent.submit(button.closest('form')!);
      });

      expect(deleteMock).toHaveBeenCalledWith('fairshift-pages');
      expect(logoutMock).toHaveBeenCalled();
    });
  });
});
