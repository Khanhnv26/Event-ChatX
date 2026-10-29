import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CloseRoomConfirmModal } from '../src/components/room/CloseRoomConfirmModal';

describe('CloseRoomConfirmModal', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders confirmation dialog with danger warnings and calls confirm', () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();

    render(
      <CloseRoomConfirmModal
        isOpen
        onClose={onClose}
        onConfirm={onConfirm}
      />
    );

    expect(screen.getByText('Đóng phòng & Khóa kết quả?')).toBeTruthy();
    expect(screen.getByText(/Vùng nguy hiểm/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận đóng phòng' }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('calls onClose when clicking cancel or close button', () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();

    render(
      <CloseRoomConfirmModal
        isOpen
        onClose={onClose}
        onConfirm={onConfirm}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Hủy bỏ' }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
