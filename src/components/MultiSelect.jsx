import { useEffect, useRef, useState } from "react";

export default function MultiSelect({ label, options, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const toggleValue = (value) => {
    if (selected.includes(value)) onChange(selected.filter((v) => v !== value));
    else onChange([...selected, value]);
  };

  const buttonLabel = selected.length === 0 ? `${label} 전체` : `${label} (${selected.length})`;

  return (
    <div className="multiselect" ref={rootRef}>
      <button
        type="button"
        className={`multiselect-trigger ${selected.length > 0 ? "multiselect-trigger-active" : ""}`}
        onClick={() => setOpen((o) => !o)}
      >
        {buttonLabel}
        <span className="multiselect-caret">▾</span>
      </button>
      {open && (
        <div className="multiselect-panel">
          {selected.length > 0 && (
            <button type="button" className="multiselect-clear" onClick={() => onChange([])}>
              선택 해제
            </button>
          )}
          {options.map((opt) => (
            <label key={opt.value} className="multiselect-option">
              <input
                type="checkbox"
                checked={selected.includes(opt.value)}
                onChange={() => toggleValue(opt.value)}
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
