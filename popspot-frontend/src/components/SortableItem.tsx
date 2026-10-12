import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { useLocale } from '@/lib/i18n';

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
  const { locale } = useLocale();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

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
      className="bg-white dark:bg-ink-800 p-3 md:p-4 rounded-lg md:rounded-xl border border-gray-200 dark:border-white/10 flex items-center gap-2.5 md:gap-4 shadow-sm mb-2 md:mb-3 pr-14 md:pr-16 group hover:border-lime-300 transition-colors"
    >
      {/* 손잡이만 드래그를 시작한다. 카드 본문에서는 모바일 스크롤을 허용한다. */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`${place.name} · ${locale === 'ko' ? '순서 변경' : locale === 'ja' ? '並べ替え' : 'Reorder'}`}
        className="grid size-11 touch-none place-items-center rounded-md cursor-grab active:cursor-grabbing text-gray-400 hover:text-lime-500 shrink-0 focus-visible:outline-2 focus-visible:outline-ring"
      >
        <GripVertical className="w-4 h-4 md:w-5 md:h-5" />
      </button>

      {/* 순서 번호 (반응형 크기 및 폰트 조절) */}
      <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-lime-300 text-ink-900 text-[10px] md:text-xs font-bold flex items-center justify-center shrink-0">
        {index + 1}
      </div>

      {/* 텍스트 영역 (min-w-0 추가하여 truncate가 제대로 작동하도록 함) */}
      <div className="flex-1 min-w-0">
        {/* 긴 이름도 삭제 버튼 아래로 밀리지 않고 자연스럽게 줄바꿈한다. */}
        <h4 className="font-bold text-gray-900 dark:text-white text-sm leading-relaxed break-words">
          {place.name}
        </h4>
        <p className="text-xs text-gray-500 dark:text-cream-200/50 mt-0.5">{place.category}</p>
      </div>
    </div>
  );
}
