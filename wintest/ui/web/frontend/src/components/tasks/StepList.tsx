import { useRef, useState } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragOverlay, type DragStartEvent, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import type { Step } from '../../api/types';
import { StepForm } from './StepForm';

interface Props {
  steps: Step[];
  onChange: (steps: Step[]) => void;
}

function SortableStep({ id, step, index, onStepChange, onStepDelete, onStepDuplicate }: {
  id: string;
  step: Step;
  index: number;
  onStepChange: (i: number, s: Step) => void;
  onStepDelete: (i: number) => void;
  onStepDuplicate: (i: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className="sortable-step">
      <div className="drag-handle" {...attributes} {...listeners}><GripVertical size={16} /></div>
      <StepForm step={step} index={index} onChange={onStepChange} onDelete={onStepDelete} onDuplicate={onStepDuplicate} />
    </div>
  );
}

// Lightweight preview shown in the DragOverlay
function DragPreview({ step, index }: { step: Step; index: number }) {
  return (
    <div className="sortable-step drag-preview">
      <div className="drag-handle"><GripVertical size={16} /></div>
      <div className="step-form">
        <div className="step-form-header">
          <span className="step-number">#{index + 1}</span>
          <span className="text-muted">{step.action}</span>
          <span className="flex-1">{step.description}</span>
        </div>
      </div>
    </div>
  );
}

export function StepList({ steps, onChange }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  // Stable IDs: each step gets a unique ID that survives reordering.
  const nextId = useRef(steps.length);
  const idsRef = useRef<string[]>(steps.map((_, i) => `step-${i}`));

  // Grow the ID list if new steps were added externally
  while (idsRef.current.length < steps.length) {
    idsRef.current.push(`step-${nextId.current++}`);
  }
  // Shrink if steps were removed externally
  if (idsRef.current.length > steps.length) {
    idsRef.current = idsRef.current.slice(0, steps.length);
  }

  const ids = idsRef.current;

  const handleDragStart = (event: DragStartEvent) => {
    const idx = ids.indexOf(String(event.active.id));
    setActiveIndex(idx >= 0 ? idx : null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveIndex(null);
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = ids.indexOf(String(active.id));
      const newIndex = ids.indexOf(String(over.id));
      idsRef.current = arrayMove(ids, oldIndex, newIndex);
      onChange(arrayMove(steps, oldIndex, newIndex));
    }
  };

  const handleStepChange = (index: number, step: Step) => {
    const updated = [...steps];
    updated[index] = step;
    onChange(updated);
  };

  const handleStepDelete = (index: number) => {
    idsRef.current = ids.filter((_, i) => i !== index);
    onChange(steps.filter((_, i) => i !== index));
  };

  const handleStepDuplicate = (index: number) => {
    const copy = { ...steps[index] };
    const updated = [...steps];
    updated.splice(index + 1, 0, copy);
    const newId = `step-${nextId.current++}`;
    const updatedIds = [...ids];
    updatedIds.splice(index + 1, 0, newId);
    idsRef.current = updatedIds;
    onChange(updated);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {steps.map((step, i) => (
          <SortableStep
            key={ids[i]}
            id={ids[i]}
            step={step}
            index={i}
            onStepChange={handleStepChange}
            onStepDelete={handleStepDelete}
            onStepDuplicate={handleStepDuplicate}
          />
        ))}
      </SortableContext>
      <DragOverlay>
        {activeIndex !== null && steps[activeIndex] ? (
          <DragPreview step={steps[activeIndex]} index={activeIndex} />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
