import { cn } from "@/lib/utils";

interface QuizProgressDotsProps {
  questions: { id: string; answered?: boolean }[];
  currentIndex: number;
  onNavigate: (index: number) => void;
}

export function QuizProgressDots({
  questions,
  currentIndex,
  onNavigate,
}: QuizProgressDotsProps) {
  return (
    <div className="flex items-center justify-center gap-1.5" role="tablist">
      {questions.map((q, idx) => (
        <button
          key={q.id}
          type="button"
          role="tab"
          aria-selected={idx === currentIndex}
          aria-label={`${idx + 1}`}
          onClick={() => onNavigate(idx)}
          className={cn(
            "h-2.5 w-2.5 rounded-full transition-all cursor-pointer",
            idx === currentIndex &&
              "ring-2 ring-primary ring-offset-2 ring-offset-background scale-125",
            q.answered && idx !== currentIndex && "bg-primary",
            !q.answered && idx !== currentIndex && "bg-muted",
          )}
        />
      ))}
    </div>
  );
}
