import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LandingView } from '../src/components/landing/LandingView';

beforeEach(() => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function setup() {
  const create = vi.fn();
  render(<LandingView onEnterRoom={vi.fn()} onCreateRoom={create} />);
  return create;
}

it.each([['2 giờ', 120], ['6 giờ', 360], ['24 giờ', 1440], ['7 ngày', 10080]])(
  'submits the %s preset as %i minutes', (label, minutes) => {
    const create = setup();
    fireEvent.click(screen.getByRole('button', { name: label, exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Tạo phòng ngay' }));
    expect(create).toHaveBeenCalledWith(expect.any(String), 'Host', minutes);
  });

it('seeds custom time from the selected preset and preserves the draft across mode changes', () => {
  const create = setup();
  fireEvent.click(screen.getByRole('button', { name: '6 giờ', exact: true }));
  fireEvent.click(screen.getByRole('button', { name: 'Tùy chỉnh', exact: true }));
  expect((screen.getByLabelText('Thời lượng') as HTMLInputElement).value).toBe('6');
  expect((screen.getByLabelText('Đơn vị thời gian') as HTMLSelectElement).value).toBe('hours');
  fireEvent.change(screen.getByLabelText('Thời lượng'), { target: { value: '30' } });
  fireEvent.change(screen.getByLabelText('Đơn vị thời gian'), { target: { value: 'minutes' } });
  fireEvent.click(screen.getByRole('button', { name: '2 giờ', exact: true }));
  fireEvent.click(screen.getByRole('button', { name: 'Tùy chỉnh', exact: true }));
  fireEvent.click(screen.getByRole('button', { name: 'Tạo phòng ngay' }));
  expect(create).toHaveBeenCalledWith(expect.any(String), 'Host', 30);
});

it.each([['5', 'minutes', 5], ['10080', 'minutes', 10080], ['3', 'hours', 180], ['2', 'days', 2880]])(
  'converts custom %s %s to %i minutes', (value, unit, minutes) => {
    const create = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Tùy chỉnh', exact: true }));
    fireEvent.change(screen.getByLabelText('Thời lượng'), { target: { value } });
    fireEvent.change(screen.getByLabelText('Đơn vị thời gian'), { target: { value: unit } });
    fireEvent.click(screen.getByRole('button', { name: 'Tạo phòng ngay' }));
    expect(create).toHaveBeenCalledWith(expect.any(String), 'Host', minutes);
  });

it.each(['', '0', '-1', '1.5', '4', '10081'])('rejects invalid custom minutes "%s"', value => {
  const create = setup();
  fireEvent.click(screen.getByRole('button', { name: 'Tùy chỉnh', exact: true }));
  fireEvent.change(screen.getByLabelText('Đơn vị thời gian'), { target: { value: 'minutes' } });
  fireEvent.change(screen.getByLabelText('Thời lượng'), { target: { value } });
  expect(screen.getByRole('alert').textContent).toContain('5 phút');
  expect((screen.getByRole('button', { name: 'Tạo phòng ngay' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.submit(document.querySelector('#form-create-room')!);
  expect(create).not.toHaveBeenCalled();
});
