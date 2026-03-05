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
      // 🔥 [반응형 수정] 패딩, 마진, 갭, 둥글기 조절
      className="bg-white dark:bg-[#222] p-3 md:p-4 rounded-lg md:rounded-xl border border-gray-200 dark:border-white/10 flex items-center gap-2.5 md:gap-4 shadow-sm mb-2 md:mb-3 group touch-none hover:border-indigo-500 transition-colors"
    >
      {/* ✋ 드래그 핸들 (모바일 아이콘 크기 및 여백 축소) */}
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-indigo-500 p-0.5 md:p-1 shrink-0">
        <GripVertical className="w-4 h-4 md:w-5 md:h-5" />
      </div>

      {/* 순서 번호 (반응형 크기 및 폰트 조절) */}
      <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-indigo-600 text-white text-[10px] md:text-xs font-bold flex items-center justify-center shrink-0">
        {index + 1}
      </div>

      {/* 텍스트 영역 (min-w-0 추가하여 truncate가 제대로 작동하도록 함) */}
      <div className="flex-1 min-w-0">
        {/* 긴 글자 말줄임표 처리 및 폰트 축소 */}
        <h4 className="font-bold text-gray-900 dark:text-white text-xs md:text-sm truncate">{place.name}</h4>
        <p className="text-[9px] md:text-[11px] text-gray-500 dark:text-white/50 mt-0.5">{place.category}</p>
      </div>
    </div>
  );
}