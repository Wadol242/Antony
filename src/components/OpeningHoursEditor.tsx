import { DAYS_ORDER } from '../constants/validation';
import type { DayKey, OpeningHoursMap } from '../types';

interface OpeningHoursEditorProps {
  value: OpeningHoursMap;
  onChange: (next: OpeningHoursMap) => void;
}

export function OpeningHoursEditor({ value, onChange }: OpeningHoursEditorProps) {
  const toggleDay = (day: DayKey) => {
    onChange({
      ...value,
      [day]: {
        ...value[day],
        open: !value[day].open,
      },
    });
  };

  const updateTime = (day: DayKey, field: 'start' | 'end', timeValue: string) => {
    const safeTime = /^\d{2}:\d{2}$/.test(timeValue) ? timeValue : value[day][field];
    onChange({
      ...value,
      [day]: {
        ...value[day],
        [field]: safeTime,
      },
    });
  };

  return (
    <div className="divide-y divide-[#F1ECF6]">
      {DAYS_ORDER.map(({ key, label }) => {
        const day = value[key];
        return (
          <div
            key={key}
            className="py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
          >
            <div className="flex items-center justify-between sm:justify-start gap-4 min-w-[170px]">
              <span className="font-semibold text-sm text-[#23093A] w-24">{label}</span>
              <button
                type="button"
                onClick={() => toggleDay(key)}
                aria-pressed={day.open}
                className={`min-h-[40px] px-4 py-1.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
                  day.open
                    ? 'bg-[#4C1D95] text-white'
                    : 'bg-[#F3ECFA] text-[#5E526B] hover:bg-[#E8DDF5]'
                }`}
              >
                {day.open ? 'Ouvert' : 'Fermé'}
              </button>
            </div>

            {day.open ? (
              <div className="flex items-center gap-2 sm:gap-3 tabular-nums">
                <label className="sr-only" htmlFor={`open-${key}`}>
                  Heure d'ouverture {label}
                </label>
                <input
                  id={`open-${key}`}
                  type="time"
                  value={day.start}
                  onChange={(e) => updateTime(key, 'start', e.target.value)}
                  className="min-h-[44px] px-3 py-2 rounded-xl border border-[#DFD5EA] bg-[#FAF8FC] text-sm font-medium text-[#1F1629] focus:outline-none focus:border-[#4C1D95] focus:bg-white"
                />
                <span className="text-sm text-[#6E5F7F]">à</span>
                <label className="sr-only" htmlFor={`close-${key}`}>
                  Heure de fermeture {label}
                </label>
                <input
                  id={`close-${key}`}
                  type="time"
                  value={day.end}
                  onChange={(e) => updateTime(key, 'end', e.target.value)}
                  className="min-h-[44px] px-3 py-2 rounded-xl border border-[#DFD5EA] bg-[#FAF8FC] text-sm font-medium text-[#1F1629] focus:outline-none focus:border-[#4C1D95] focus:bg-white"
                />
              </div>
            ) : (
              <span className="text-sm text-[#867996]">Salon fermé ce jour</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
