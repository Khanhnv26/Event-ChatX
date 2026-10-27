import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import { toast, useToastStore } from '../src/stores/toastStore';

describe('Toast Store & Imperative API', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useToastStore.getState().clearToasts();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('adds toasts with default types and properties', () => {
    const id = toast('Thông báo thông thường');
    const toasts = useToastStore.getState().toasts;

    expect(toasts).toHaveLength(1);
    expect(toasts[0].id).toBe(id);
    expect(toasts[0].title).toBe('Thông báo thông thường');
    expect(toasts[0].type).toBe('info');
    expect(toasts[0].duration).toBe(4000);
  });

  it('supports success, error, warning, loading helper methods', () => {
    toast.success('Thành công!');
    toast.error('Có lỗi xảy ra');
    toast.warning('Cảnh báo!');
    toast.loading('Đang xử lý...');

    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(4);
    expect(toasts[0].type).toBe('success');
    expect(toasts[0].duration).toBe(4000);
    expect(toasts[1].type).toBe('error');
    expect(toasts[1].duration).toBe(6000);
    expect(toasts[2].type).toBe('warning');
    expect(toasts[2].duration).toBe(6000);
    expect(toasts[3].type).toBe('loading');
    expect(toasts[3].duration).toBe(0);
  });

  it('enforces FIFO limit of 4 toasts', () => {
    toast.info('Toast 1');
    toast.info('Toast 2');
    toast.info('Toast 3');
    toast.info('Toast 4');
    expect(useToastStore.getState().toasts).toHaveLength(4);

    toast.info('Toast 5');
    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(4);
    expect(toasts.map((t) => t.title)).toEqual(['Toast 2', 'Toast 3', 'Toast 4', 'Toast 5']);
  });

  it('auto-dismisses toasts after duration', () => {
    toast.success('Tự đóng sau 4s', { duration: 4000 });
    expect(useToastStore.getState().toasts).toHaveLength(1);

    vi.advanceTimersByTime(3999);
    expect(useToastStore.getState().toasts).toHaveLength(1);

    vi.advanceTimersByTime(2);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('does not auto-dismiss loading toasts with duration 0', () => {
    toast.loading('Đang tải...');
    vi.advanceTimersByTime(100000);
    expect(useToastStore.getState().toasts).toHaveLength(1);
  });

  it('dismisses toast manually by id and clearToasts', () => {
    const id1 = toast.success('T1');
    const id2 = toast.success('T2');
    expect(useToastStore.getState().toasts).toHaveLength(2);

    toast.dismiss(id1);
    expect(useToastStore.getState().toasts).toHaveLength(1);
    expect(useToastStore.getState().toasts[0].id).toBe(id2);

    toast.dismiss();
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('pauses and resumes timer correctly', () => {
    const id = toast.success('Pause Test', { duration: 4000 });
    vi.advanceTimersByTime(2000);

    useToastStore.getState().pauseToast(id);
    vi.advanceTimersByTime(5000);
    expect(useToastStore.getState().toasts).toHaveLength(1);

    useToastStore.getState().resumeToast(id);
    vi.advanceTimersByTime(1999);
    expect(useToastStore.getState().toasts).toHaveLength(1);

    vi.advanceTimersByTime(2);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('handles toast.promise resolving successfully', async () => {
    const asyncTask = new Promise<string>((resolve) => {
      setTimeout(() => resolve('Xong!'), 100);
    });

    const promise = toast.promise(asyncTask, {
      loading: 'Đang tải dữ liệu...',
      success: (data) => `Thành công: ${data}`,
      error: 'Thất bại',
    });

    expect(useToastStore.getState().toasts[0].type).toBe('loading');
    expect(useToastStore.getState().toasts[0].title).toBe('Đang tải dữ liệu...');

    vi.advanceTimersByTime(100);
    await promise;

    expect(useToastStore.getState().toasts).toHaveLength(1);
    expect(useToastStore.getState().toasts[0].type).toBe('success');
    expect(useToastStore.getState().toasts[0].title).toBe('Thành công: Xong!');
  });

  it('handles toast.promise rejecting with error', async () => {
    const failedTask = new Promise<string>((_, reject) => {
      setTimeout(() => reject(new Error('Lỗi mạng')), 100);
    });

    const promise = toast.promise(failedTask, {
      loading: 'Đang gửi...',
      success: 'Xong',
      error: (err: any) => `Lỗi: ${err.message}`,
    });

    vi.advanceTimersByTime(100);
    await expect(promise).rejects.toThrow('Lỗi mạng');

    expect(useToastStore.getState().toasts).toHaveLength(1);
    expect(useToastStore.getState().toasts[0].type).toBe('error');
    expect(useToastStore.getState().toasts[0].title).toBe('Lỗi: Lỗi mạng');
  });
});
