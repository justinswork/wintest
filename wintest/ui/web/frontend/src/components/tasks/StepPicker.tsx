import { useTestStore } from '../../stores/testStore';

interface Props {
  value: string;
  onChange: (stepType: string) => void;
}

export function StepPicker({ value, onChange }: Props) {
  const { stepTypes } = useTestStore();
  // Group AI-requiring steps at the bottom; stable sort preserves order within each group.
  const sorted = [...stepTypes].sort(
    (a, b) => Number(a.requires_vision) - Number(b.requires_vision),
  );

  return (
    <select value={value} onChange={e => onChange(e.target.value)} className="input" style={{ width: 200 }}>
      {sorted.map(s => (
        <option key={s.name} value={s.name}>
          {s.requires_vision ? `✨ ${s.label}` : s.label}
        </option>
      ))}
    </select>
  );
}
