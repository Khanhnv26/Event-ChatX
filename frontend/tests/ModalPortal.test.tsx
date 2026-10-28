import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ModalPortal } from '../src/components/common/ModalPortal';
import { MotionPresence } from '../src/components/common/MotionPresence';
import { useState } from 'react';
import { ConfirmModal } from '../src/components/ui/ConfirmModal';

afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

it('keeps keyboard focus inside the dialog and dismisses on Escape', () => {
  const close = vi.fn();
  render(<><button>Outside</button><ModalPortal onClose={close}>
    <div className="motion-overlay"><section role="dialog" aria-label="Test"><button>First</button><button>Last</button></section></div>
  </ModalPortal></>);
  expect(document.activeElement).toBe(screen.getByText('First'));
  screen.getByText('Last').focus();
  fireEvent.keyDown(document, { key: 'Tab' });
  expect(document.activeElement).toBe(screen.getByText('First'));
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(close).toHaveBeenCalledOnce();
});

it('keeps the portaled closing dialog inert until its exit completes', () => {
  vi.useFakeTimers();
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  const content = <ModalPortal><section role="dialog" aria-label="Test">Dialog</section></ModalPortal>;
  const view = render(<MotionPresence open>{content}</MotionPresence>);
  view.rerender(<MotionPresence open={false}>{content}</MotionPresence>);
  expect(screen.getByText('Dialog').closest('[inert]')).not.toBeNull();
  act(() => { vi.advanceTimersByTime(280); });
  expect(screen.queryByText('Dialog')).toBeNull();
});

it('dismisses only the top dialog and restores focus to its parent', () => {
  const closeParent = vi.fn();
  function Harness() {
    const [nested, setNested] = useState(false);
    return <ModalPortal onClose={closeParent}>
      <div className="motion-overlay"><section role="dialog" aria-label="Parent">
        <button onClick={() => setNested(true)}>Open child</button>
        {nested && <ModalPortal onClose={() => setNested(false)}>
          <div className="motion-overlay"><section role="dialog" aria-label="Child"><button>Child action</button></section></div>
        </ModalPortal>}
      </section></div>
    </ModalPortal>;
  }
  const view = render(<Harness />);
  fireEvent.click(screen.getByText('Open child'));
  expect(document.activeElement).toBe(screen.getByText('Child action'));
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('dialog', { name: 'Child' })).toBeNull();
  expect(closeParent).not.toHaveBeenCalled();
  expect(document.activeElement).toBe(screen.getByText('Open child'));
  expect(document.body.style.overflow).toBe('hidden');
  view.unmount();
  expect(document.body.style.overflow).not.toBe('hidden');
});

it('allows canceling confirmation without confirming and blocks dismissal while pending', () => {
  const close = vi.fn();
  const confirm = vi.fn();
  const props = { title: 'Loại thành viên?', description: 'Thu hồi phiên hiện tại.', confirmLabel: 'Loại thành viên', onClose: close, onConfirm: confirm };
  const view = render(<ConfirmModal {...props} />);
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Hủy bỏ' }));
  fireEvent.click(screen.getByRole('button', { name: 'Hủy bỏ' }));
  expect(close).toHaveBeenCalledOnce();
  expect(confirm).not.toHaveBeenCalled();
  view.rerender(<ConfirmModal {...props} pending />);
  fireEvent.keyDown(document, { key: 'Escape' });
  fireEvent.click(screen.getByRole('alertdialog').parentElement!);
  expect(close).toHaveBeenCalledOnce();
  expect((screen.getByRole('button', { name: 'Hủy bỏ' }) as HTMLButtonElement).disabled).toBe(true);
});
