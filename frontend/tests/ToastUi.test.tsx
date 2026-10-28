import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastContainer } from '../src/components/ui/ToastContainer';
import { toast, useToastStore } from '../src/stores/toastStore';
import { PreloaderProvider } from '../src/components/common/PreloaderContext';

describe('Toast UI Component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useToastStore.getState().clearToasts();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('renders nothing when there are no toasts', () => {
    const { container } = render(<ToastContainer />);
    expect(container.firstChild).toBeNull();
  });

  it('renders toast with title and description', () => {
    render(<ToastContainer />);
    act(() => {
      toast.success('Thành công', { description: 'Chi tiết thêm về hành động' });
    });

    expect(screen.getByText('Thành công')).toBeTruthy();
    expect(screen.getByText('Chi tiết thêm về hành động')).toBeTruthy();
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('renders error toast with role alert', () => {
    render(<ToastContainer />);
    act(() => {
      toast.error('Có lỗi xảy ra');
    });

    expect(screen.getByText('Có lỗi xảy ra')).toBeTruthy();
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('handles action button click', () => {
    const onAction = vi.fn((dismiss) => dismiss());
    render(<ToastContainer />);

    act(() => {
      toast.info('Tin nhắn có nút bấm', {
        action: { label: 'Thử lại', onClick: onAction },
      });
    });

    const actionBtn = screen.getByRole('button', { name: 'Thử lại' });
    expect(actionBtn).toBeTruthy();

    fireEvent.click(actionBtn);
    expect(onAction).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.queryByText('Tin nhắn có nút bấm')).toBeNull();
  });

  it('allows dismissing via close button', () => {
    render(<ToastContainer />);
    act(() => {
      toast.warning('Cảnh báo nguy hiểm');
    });

    const closeBtn = screen.getByRole('button', { name: 'Đóng thông báo' });
    expect(closeBtn).toBeTruthy();

    fireEvent.click(closeBtn);

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.queryByText('Cảnh báo nguy hiểm')).toBeNull();
  });

  it('handles mouse enter and leave for pausing timer', () => {
    render(<ToastContainer />);
    act(() => {
      toast.info('Hover me', { duration: 3000 });
    });

    const toastElement = screen.getByRole('status');

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    fireEvent.mouseEnter(toastElement);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByText('Hover me')).toBeTruthy();

    fireEvent.mouseLeave(toastElement);
    act(() => {
      vi.advanceTimersByTime(2001);
    });
    expect(screen.queryByText('Hover me')).toBeNull();
  });

  it('hides toast during preload and reveals queued toasts after preload completes', () => {
    render(
      <PreloaderProvider>
        <ToastContainer />
      </PreloaderProvider>
    );

    act(() => {
      toast.success('Toast during preload 1');
      toast.info('Toast during preload 2');
      toast.warning('Toast during preload 3');
      toast.error('Toast during preload 4');
    });

    expect(screen.queryByText('Toast during preload 1')).toBeNull();
    expect(screen.queryByText('Toast during preload 2')).toBeNull();
    expect(screen.queryByText('Toast during preload 3')).toBeNull();
    expect(screen.queryByText('Toast during preload 4')).toBeNull();

    act(() => {
      vi.advanceTimersByTime(1500);
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(screen.queryByText('Toast during preload 1')).toBeNull();
    expect(screen.getByText('Toast during preload 2')).toBeTruthy();
    expect(screen.getByText('Toast during preload 3')).toBeTruthy();
    expect(screen.getByText('Toast during preload 4')).toBeTruthy();
  });
});
