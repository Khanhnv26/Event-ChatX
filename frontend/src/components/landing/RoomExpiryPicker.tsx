import { useState } from 'react';
import { Settings2 } from 'lucide-react';

const PRESETS = [
  { id: '2h', label: '2 giờ', minutes: 120 },
  { id: '6h', label: '6 giờ', minutes: 360 },
  { id: '24h', label: '24 giờ', minutes: 1440 },
  { id: '7d', label: '7 ngày', minutes: 10080 },
];
const MULTIPLIER = { minutes: 1, hours: 60, days: 1440 };
type Draft = { value: string; unit: keyof typeof MULTIPLIER };

function toMinutes(draft: Draft): number | null {
  if (!draft.value.trim()) return null;
  const value = Number(draft.value);
  const minutes = value * MULTIPLIER[draft.unit];
  return Number.isSafeInteger(value) && value > 0 && minutes >= 5 && minutes <= 10080 ? minutes : null;
}

export function RoomExpiryPicker({ onChange }: { onChange: (minutes: number | null) => void }) {
  const [selected, setSelected] = useState('24h');
  const [draft, setDraft] = useState<Draft | null>(null);
  const custom = selected === 'custom';
  const invalid = custom && draft !== null && toMinutes(draft) === null;
  const chooseCustom = () => {
    const preset = PRESETS.find(item => item.id === selected) ?? PRESETS[2];
    const next: Draft = draft ?? (preset.id === '7d'
      ? { value: '7', unit: 'days' } : { value: String(preset.minutes / 60), unit: 'hours' });
    setDraft(next);
    setSelected('custom');
    onChange(toMinutes(next));
  };
  const update = (next: Draft) => { setDraft(next); onChange(toMinutes(next)); };
  return <fieldset className="min-w-0">
    <legend className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Thời gian hết hạn</legend>
    <div className="grid grid-cols-4 gap-2">
      {PRESETS.map(item => <button key={item.id} type="button" aria-pressed={selected === item.id}
        onClick={() => { setSelected(item.id); onChange(item.minutes); }}
        className={`py-1.5 px-1.5 rounded-lg text-xs font-medium border text-center transition-all cursor-pointer ${selected === item.id
          ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-bold shadow-sm'
          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>{item.label}</button>)}
    </div>
    <button type="button" onClick={chooseCustom} aria-pressed={custom} aria-expanded={custom} aria-controls="custom-room-expiry"
      className={`mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${custom
        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300'
        : 'border-dashed border-slate-300 dark:border-slate-700 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-300'}`}>
      <Settings2 className="size-3.5" />Tùy chỉnh
    </button>
    <div id="custom-room-expiry" className="expiry-custom-reveal" data-expanded={custom} aria-hidden={!custom} inert={!custom}>
      <div className="min-h-0 overflow-hidden">
        {draft && <div className="pt-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="room-expiry-value" className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1">Thời lượng</label>
              <input id="room-expiry-value" type="number" inputMode="numeric" step="1"
                min={draft.unit === 'minutes' ? 5 : 1} max={10080 / MULTIPLIER[draft.unit]}
                value={draft.value} disabled={!custom} aria-invalid={invalid} aria-describedby="room-expiry-hint"
                onChange={event => update({ ...draft, value: event.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/70 text-sm text-slate-900 dark:text-white" />
            </div>
            <div>
              <label htmlFor="room-expiry-unit" className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1">Đơn vị thời gian</label>
              <select id="room-expiry-unit" value={draft.unit} disabled={!custom}
                onChange={event => update({ ...draft, unit: event.target.value as Draft['unit'] })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white">
                <option value="minutes">Phút</option><option value="hours">Giờ</option><option value="days">Ngày</option>
              </select>
            </div>
          </div>
          <p id="room-expiry-hint" role={invalid ? 'alert' : undefined}
            className={`text-[11px] leading-relaxed ${invalid ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'}`}>
            {invalid ? 'Nhập số nguyên với thời lượng từ 5 phút đến 7 ngày.' : 'Chọn thời lượng từ 5 phút đến 7 ngày.'}
          </p>
        </div>}
      </div>
    </div>
  </fieldset>;
}
