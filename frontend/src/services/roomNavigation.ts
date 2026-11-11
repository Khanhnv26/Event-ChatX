import { isMotionEnabled } from './motionPreference';

export function focusRoomElement(container: ParentNode | null, attribute: 'data-message-id' | 'data-decision-id', id: string) {
  const target = Array.from(container?.querySelectorAll<HTMLElement>(`[${attribute}]`) ?? [])
    .find(element => element.getAttribute(attribute) === id);
  if (!target) return false;
  const details = target.closest('details');
  if (details && details !== target) details.open = true;
  target.focus({ preventScroll: true });
  target.scrollIntoView?.({ behavior: isMotionEnabled() ? 'smooth' : 'auto', block: 'center' });
  return true;
}
