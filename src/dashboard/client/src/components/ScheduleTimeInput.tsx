import { useEffect, useRef } from 'react';
import { TimepickerUI } from 'timepicker-ui';
import 'timepicker-ui/main.css';
import 'timepicker-ui/theme-dark.css';

/** Format 24h hour (0-23) and minute (0-59) to "9:00 AM" for timepicker-ui. */
function formatTime12(hour24: number, minute: number): string {
  const isPM = hour24 >= 12;
  const h = hour24 % 12 || 12;
  const m = String(minute).padStart(2, '0');
  return `${h}:${m} ${isPM ? 'PM' : 'AM'}`;
}

/** Convert 12h + AM/PM to 24h hour (0-23). */
function to24h(hour12: number, type: string): number {
  if (type === 'PM') {return hour12 === 12 ? 12 : hour12 + 12;}
  return hour12 === 12 ? 0 : hour12;
}

interface ScheduleTimeInputProps {
  hour: number;
  minute: number;
  onChange: (hour: number, minute: number) => void;
  className?: string;
  id?: string;
}

export function ScheduleTimeInput({ hour, minute, onChange, className, id }: ScheduleTimeInputProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const input = inputRef.current;
    if (!input) {return;}

    input.value = formatTime12(hour, minute);

    interface TimepickerConfirmPayload {
      hour: string | number;
      minutes: string | number;
      type: string;
    }

    const picker = new TimepickerUI(input, {
      clock: {
        type: '12h',
        incrementMinutes: 15,
        autoSwitchToMinutes: true,
      },
      ui: {
        theme: 'dark',
        animation: true,
        backdrop: true,
      },
      callbacks: {
        onConfirm: (data) => {
          const payload = data as TimepickerConfirmPayload;
          const h24 = to24h(Number(payload.hour), payload.type);
          const min = Number(payload.minutes) || 0;
          onChangeRef.current(h24, min);
        },
      },
    });

    picker.create();

    return () => picker.destroy();
  }, [hour, minute]);

  return (
    <input
      ref={inputRef}
      type="text"
      readOnly
      id={id}
      className={className}
      placeholder="Select time"
      aria-label="Schedule time"
    />
  );
}
