import { Radio, Square } from "lucide-react";
import { useParams } from "react-router-dom";
import { Button } from "../components/ui/button";

export function BroadcastPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <main className="live-shell">
      <header className="live-header">
        <div>
          <h1>위치 공유 중</h1>
          <p>GPS 확인 전입니다. 곧 위치 전송 흐름을 연결합니다.</p>
        </div>
        <Radio className="status-icon" size={28} aria-label="공유 중" />
      </header>

      <section className="map-placeholder" aria-label="지도 자리">
        <div className="vehicle-marker">차</div>
      </section>

      <footer className="bottom-panel">
        <p>공유 ID: {id}</p>
        <Button className="secondary-action" type="button" variant="secondary">
          <Square size={18} aria-hidden="true" />
          공유 중지
        </Button>
      </footer>
    </main>
  );
}
