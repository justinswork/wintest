import { useTestStore } from '../../stores/testStore';

interface Props {
  value: string;
  onChange: (stepType: string) => void;
}

export function StepPicker({ value, onChange }: Props) {
  const { stepTypes } = useTestStore();

  return (
    <select value={value} onChange={e => onChange(e.target.value)} className="input">
      {stepTypes.map(s => (
        <option key={s.name} value={s.name}>{s.name}</option>
      ))}
    </select>
  );
}
