import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

interface Place {
  id: string;
  name: string;
  category: string;
}

interface Props {
  id: string;
  place: Place;
  index: number;
}

export function SortableItem({ id, place, index }: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white dark:bg-[#222] p-4 rounded-xl border border-gray-200 dark:border-white/10 flex items-center gap-4 shadow-sm mb-3 group touch-none hover:border-indigo-500 transition-colors"
    >
      {/* ✋ 드래그 핸들 */}
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-indigo-500 p-1">
        <GripVertical size={20} />
      </div>

      {/* 순서 번호 */}
      <div className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
        {index + 1}
      </div>

      <div className="flex-1">
        <h4 className="font-bold text-gray-900 dark:text-white text-sm">{place.name}</h4>
        <p className="text-xs text-gray-500 dark:text-white/50">{place.category}</p>
      </div>
    </div>
  );
}