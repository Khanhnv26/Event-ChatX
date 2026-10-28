import { useContext, useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { MotionPresenceContext } from './motionPresenceContext';

const modalStack: HTMLElement[] = [];
const restoreChains = new WeakMap<HTMLElement, HTMLElement[]>();
let originalOverflow = '';

function syncModalStack() {
  modalStack.forEach((element, index) => {
    const blocked = index !== modalStack.length - 1;
    element.style.setProperty('--modal-layer', String(index));
    element.inert = blocked;
    element.setAttribute('aria-hidden', String(blocked));
  });
}

function captureFocus(): HTMLElement[] {
  if (typeof document === 'undefined' || !(document.activeElement instanceof HTMLElement)) return [];
  const active = document.activeElement;
  const owner = active.closest<HTMLElement>('.modal-root');
  return [active, ...(owner ? restoreChains.get(owner) ?? [] : [])];
}

function focusableElements(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex]'))
    .filter(element => {
      if (element.matches(':disabled, [tabindex="-1"]')) return false;
      for (let node: HTMLElement | null = element; node && node !== root; node = node.parentElement) {
        if (node.hidden || node.inert || getComputedStyle(node).display === 'none' || getComputedStyle(node).visibility === 'hidden') return false;
        if (node.tagName === 'DETAILS' && !node.hasAttribute('open') && !node.querySelector('summary')?.contains(element)) return false;
      }
      return true;
    });
}

export function ModalPortal({ children, onClose, dismissible = true }: {
  children: ReactNode; onClose?: () => void; dismissible?: boolean;
}) {
  const presence = useContext(MotionPresenceContext);
  const rootRef = useRef<HTMLDivElement>(null);
  const restoreTarget = useRef(captureFocus());
  const handlers = useRef({ onClose, dismissible });
  useEffect(() => { handlers.current = { onClose, dismissible }; });

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !presence.open) return;
    const focusRestore = root.contains(document.activeElement) ? restoreTarget.current : captureFocus();
    restoreTarget.current = focusRestore;
    if (modalStack.length === 0) {
      originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    modalStack.push(root);
    restoreChains.set(root, focusRestore);
    modalStack.sort((a, b) => a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);
    syncModalStack();
    const isTop = () => modalStack.at(-1) === root;
    const focusFirst = () => {
      const target = root.querySelector<HTMLElement>('[data-modal-autofocus]') ?? focusableElements(root)[0];
      const dialog = root.querySelector<HTMLElement>('[role="dialog"], [role="alertdialog"]');
      if (target) target.focus({ preventScroll: true });
      else if (dialog) { dialog.tabIndex = -1; dialog.focus({ preventScroll: true }); }
    };
    if (isTop() && !root.contains(document.activeElement)) focusFirst();
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isTop()) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        if (handlers.current.dismissible) handlers.current.onClose?.();
      }
      if (event.key !== 'Tab') return;
      const elements = focusableElements(root);
      const first = elements[0];
      const last = elements.at(-1);
      if (!first) { event.preventDefault(); focusFirst(); return; }
      if (event.shiftKey && (document.activeElement === first || !root.contains(document.activeElement))) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !root.contains(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    };
    const onFocus = (event: FocusEvent) => {
      if (isTop() && !root.contains(event.target as Node)) focusFirst();
    };
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('focusin', onFocus);
    return () => {
      const wasTop = isTop();
      const index = modalStack.indexOf(root);
      if (index >= 0) modalStack.splice(index, 1);
      restoreChains.delete(root);
      syncModalStack();
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('focusin', onFocus);
      if (modalStack.length === 0) document.body.style.overflow = originalOverflow;
      const previous = focusRestore.find(element => element.isConnected && !element.closest('[inert]') && !element.matches(':disabled'));
      if (wasTop) previous?.focus({ preventScroll: true });
    };
  }, [presence.open]);

  if (typeof document === 'undefined' || !document.body) {
    return <>{children}</>;
  }
  return createPortal(<div ref={rootRef} className="modal-root motion-presence"
    data-state={presence.open ? 'open' : 'closed'} inert={!presence.open} aria-hidden={!presence.open || undefined}
    style={{ '--presence-duration': `${presence.duration}ms` } as CSSProperties}
    onClick={event => {
      if (modalStack.at(-1) === rootRef.current && event.target instanceof HTMLElement && event.target.classList.contains('motion-overlay') && dismissible) onClose?.();
    }}>{children}</div>, document.body);
}
