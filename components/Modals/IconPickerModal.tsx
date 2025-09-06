/**
 * IconPickerModal - 이모지/아이콘 선택 모달
 * 
 * 주요 역할:
 * 1. 사전 정의된 이모지/아이콘 목록을 그리드로 표시
 * 2. 검색어 기반 필터링 제공(한글/영문 키워드 포함)
 * 3. 선택 시 콜백(onSelect)으로 선택된 아이콘 전달
 * 
 * 핵심 특징:
 * - Dialog 컴포넌트 사용한 접근성 친화적 모달
 * - 키워드 매칭을 위한 간단한 로컬 필터링
 * - 가벼운 정적 아이콘 목록으로 유지보수 용이
 * 
 * 주의사항:
 * - 목록은 필요 시 쉽게 확장 가능
 * - 외부 라이브러리 없이 기본 이모지 사용
 */
import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/Ui/data-display";
import { Input } from "@/components/Ui/form-controls";

interface IconPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (icon: string) => void;
}

type IconItem = { icon: string; keywords: string[] };

const ICON_CATALOG: IconItem[] = [
  { icon: "🎯", keywords: ["goal", "타겟", "목표"] },
  { icon: "🏠", keywords: ["home", "랜딩", "landing"] },
  { icon: "📝", keywords: ["form", "양식", "입력"] },
  { icon: "📧", keywords: ["email", "메일"] },
  { icon: "🛒", keywords: ["cart", "checkout", "결제"] },
  { icon: "✅", keywords: ["done", "완료", "감사"] },
  { icon: "💾", keywords: ["data", "저장", "소스"] },
  { icon: "📊", keywords: ["analytics", "분석"] },
  { icon: "⚙️", keywords: ["설정", "settings"] },
  { icon: "🚀", keywords: ["배포", "런칭", "launch"] },
  { icon: "🧲", keywords: ["리드", "lead", "attract"] },
  { icon: "🔔", keywords: ["알림", "notify"] },
  { icon: "🧪", keywords: ["실험", "ab", "test"] },
  { icon: "🔍", keywords: ["검색", "search"] },
  { icon: "💬", keywords: ["채팅", "대화", "chat"] },
  { icon: "📈", keywords: ["성장", "growth", "trend"] },
  { icon: "🧭", keywords: ["네비", "경로", "nav"] },
  { icon: "🧩", keywords: ["통합", "integration", "plugin"] },
  { icon: "🧰", keywords: ["툴", "toolbox"] },
  { icon: "🖼️", keywords: ["이미지", "image"] },
  { icon: "🧾", keywords: ["영수증", "receipt"] },
  { icon: "🧠", keywords: ["ai", "지능"] },
  { icon: "⏱️", keywords: ["타이머", "시간"] },
  { icon: "🔗", keywords: ["연결", "link"] },
  { icon: "📎", keywords: ["첨부", "attachment"] },
  { icon: "🗂️", keywords: ["폴더", "folder"] },
  { icon: "🧑‍💻", keywords: ["개발", "dev"] },
  { icon: "🛠️", keywords: ["수정", "fix", "tool"] },
  { icon: "🧹", keywords: ["정리", "cleanup"] },
  { icon: "🧮", keywords: ["수치", "계산"] },
  { icon: "🧭", keywords: ["direction", "가이드"] },
  { icon: "🗺️", keywords: ["맵", "map"] },
  { icon: "🗓️", keywords: ["캘린더", "일정"] },
  { icon: "📅", keywords: ["날짜", "date"] },
  { icon: "🧷", keywords: ["핀", "pin"] },
  { icon: "📌", keywords: ["고정", "pin"] },
  { icon: "🧱", keywords: ["벽", "block"] },
  { icon: "🪄", keywords: ["매직", "wizard"] },
  { icon: "🧯", keywords: ["긴급", "emergency"] },
  { icon: "📦", keywords: ["패키지", "box"] },
  { icon: "💡", keywords: ["아이디어", "idea"] },
  { icon: "🧵", keywords: ["스레드", "thread"] },
  { icon: "🔄", keywords: ["동기화", "sync"] },
  { icon: "🗣️", keywords: ["피드백", "feedback"] },
  { icon: "🧷", keywords: ["연결", "clip"] },
  { icon: "📣", keywords: ["공지", "announce"] },
  { icon: "🔐", keywords: ["보안", "security"] },
  { icon: "🪪", keywords: ["프로필", "id"] },
  { icon: "🧳", keywords: ["여정", "journey"] },
  { icon: "🧭", keywords: ["경로", "flow"] },
  { icon: "🧷", keywords: ["연결", "connector"] },
].reduce<IconItem[]>((acc, item) => {
  // 중복 제거
  if (!acc.find((x) => x.icon === item.icon)) acc.push(item);
  return acc;
}, []);

export default function IconPickerModal({ open, onOpenChange, onSelect }: IconPickerModalProps) {
  const [keyword, setKeyword] = useState("");

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    if (!q) return ICON_CATALOG;
    return ICON_CATALOG.filter((item) =>
      item.icon.includes(q) || item.keywords.some((k) => k.toLowerCase().includes(q))
    );
  }, [keyword]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>아이콘 선택</DialogTitle>
          <DialogDescription>노드에 사용할 아이콘을 선택하세요.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Input
            placeholder="검색 (예: 메일, 분석, growth...)"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />

          <div className="grid grid-cols-8 gap-2 max-h-64 overflow-auto">
            {filtered.map((item) => (
              <button
                key={item.icon}
                type="button"
                className="h-10 w-10 rounded-lg border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-lg"
                onClick={() => onSelect(item.icon)}
                aria-label={`아이콘 ${item.icon} 선택`}
              >
                <span>{item.icon}</span>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="col-span-8 text-center text-sm text-gray-500 py-4">
                검색 결과가 없습니다.
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


