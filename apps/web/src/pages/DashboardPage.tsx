import { Plus, Radio } from "lucide-react";
import { Button } from "../components/ui/button";

export function DashboardPage() {
  return (
    <main className="app-shell">
      <header className="brand-header" aria-label="진형링크">
        <div className="brand-mark" aria-hidden="true">
          <Radio size={26} />
        </div>
        <div>
          <p className="eyebrow">진형링크</p>
          <p className="muted">실시간 위치</p>
        </div>
      </header>

      <section className="hero-section">
        <h1>내 위치 공유</h1>
        <p>친구가 기다리는 동안 현재 위치와 도착 흐름을 확인할 수 있게 공유해요.</p>
        <Button className="primary-action" type="button" size="wide">
          <Plus size={22} aria-hidden="true" />
          새 위치 공유
        </Button>
      </section>

      <section className="empty-state" aria-label="위치 공유 목록">
        <p className="eyebrow">공유 목록</p>
        <p>로그인과 데이터 연결이 이어지면 이곳에서 위치 공유를 관리합니다.</p>
      </section>
    </main>
  );
}
