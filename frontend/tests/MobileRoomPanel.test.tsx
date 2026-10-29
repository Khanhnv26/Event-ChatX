import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MobileRoomPanel, type MobileRoomTab } from '../src/components/room/workspace/MobileRoomPanel';
import { DecisionPanel } from '../src/components/room/workspace/DecisionPanel';

afterEach(cleanup);

it('uses one dialog, keeps a decision draft across tabs, and supports keyboard tab navigation', () => {
  function Harness() {
    const [tab, setTab] = useState<MobileRoomTab>('decisions');
    return <MobileRoomPanel tab={tab} onTabChange={setTab} onClose={vi.fn()} roomTitle="Room" confirmedCount={0} participantCount={2}
      roomInfo={<p>Room metadata</p>}
      decisions={<DecisionPanel mobile decisions={[]} roomStatus="ACTIVE" showForm onConfirmDecision={vi.fn()} onAddDecision={vi.fn()} />}
      participants={<p>Member list</p>} />;
  }
  render(<Harness />);
  expect(screen.getAllByRole('dialog')).toHaveLength(1);
  expect(screen.getAllByRole('tab')).toHaveLength(2);
  fireEvent.change(screen.getByPlaceholderText('Tiêu đề quyết định...'), { target: { value: 'Draft decision' } });
  fireEvent.click(screen.getByRole('tab', { name: 'Thành viên (2)' }));
  expect(screen.getByRole('tabpanel').textContent).toContain('Member list');
  const members = screen.getByRole('tab', { name: 'Thành viên (2)' });
  members.focus();
  fireEvent.keyDown(members, { key: 'ArrowLeft' });
  expect(screen.getByRole('tab', { name: 'Quyết định (0)' }).getAttribute('aria-selected')).toBe('true');
  expect((screen.getByPlaceholderText('Tiêu đề quyết định...') as HTMLInputElement).value).toBe('Draft decision');
});
