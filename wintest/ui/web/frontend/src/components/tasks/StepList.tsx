import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import type { Step } from '../../api/types';
import { StepForm } from './StepForm';

interface Props {
  steps: Step[];
  onChange: (steps: Step[]) => void;
}

function SortableStep({ id, step, index, onStepChange, onStepDelete }: {
  id: string;
  step: Step;
  index: number;
  onStepChange: (i: number, s: Step) => void;
  onStepDelete: (i: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="sortable-step">
      <div className="drag-handle" {...attributes} {...listeners}><GripVertical size={16} /></div>
      <StepForm step={step} index={index} onChange={onStepChange} onDelete={onStepDelete} />
    </div>
  );
}

export function StepList({ steps, onChange }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const ids = steps.map((_, i) => `step-${i}`);

  const handleDragEnd = (event: { active: { id: string | number }; over: { id: string | number } | null }) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = ids.indexOf(String(active.id));
      const newIndex = ids.indexOf(String(over.id));
      onChange(arrayMove(steps, oldIndex, newIndex));
    }
  };

  const handleStepChange = (index: number, step: Step) => {
    const updated = [...steps];
    updated[index] = step;
    onChange(updated);
  };

  const handleStepDelete = (index: number) => {
    onChange(steps.filter((_, i) => i !== index));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {steps.map((step, i) => (
          <SortableStep
            key={ids[i]}
            id={ids[i]}
            step={step}
            index={i}
            onStepChange={handleStepChange}
            onStepDelete={handleStepDelete}
          />
        ))}
      </SortableContext>
    </DndContext>
  );
}
