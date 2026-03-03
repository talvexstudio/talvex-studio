// COMPOSITION-ONLY: derived from AdminPage.tsx input styling. Approved pattern: ISO display overlay for native date input.
import { useRef, type ChangeEvent } from "react";

type IsoDateInputProps = {
  value: string;
  onChange: (nextIso: string) => void;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
  name?: string;
  id?: string;
};

export function IsoDateInput({
  value,
  onChange,
  className = "",
  disabled = false,
  placeholder = "YYYY-MM-DD",
  name,
  id,
}: IsoDateInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hasValue = Boolean(value);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value);
  };

  const openPicker = () => {
    const el = inputRef.current;
    if (!el || disabled) return;
    el.focus();
    const anyEl = el as any;
    if (typeof anyEl.showPicker === "function") {
      anyEl.showPicker();
    } else {
      el.click();
    }
  };

  return (
    <div className="relative w-full rounded-[12px] border border-transparent focus-within:border-[#2563eb] focus-within:ring-2 focus-within:ring-[#2563eb]/20">
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="date"
        value={value || ""}
        onChange={handleChange}
        disabled={disabled}
        className="peer absolute inset-0 z-0 h-full w-full cursor-text opacity-0 disabled:cursor-not-allowed"
      />
      <div
        aria-hidden="true"
        onMouseDown={(event) => {
          event.preventDefault();
          openPicker();
        }}
        className={`iso-date-display relative z-10 flex min-h-[40px] items-center rounded-[12px] border border-slate-200 px-3 py-2 text-sm peer-focus:border-[#2563eb] ${
          className || "w-full text-slate-700"
        } ${hasValue ? "text-slate-700" : "text-slate-400"} ${
          disabled ? "cursor-not-allowed bg-slate-50" : "cursor-text bg-white"
        }`}
      >
        {hasValue ? value : placeholder}
      </div>
    </div>
  );
}
