import { MapPin } from "lucide-react";
import { useParams } from "react-router-dom";

export function TrackingPage() {
  const { code } = useParams<{ code: string }>();

  return (
    <main className="live-shell">
      <section className="tracking-summary">
        <p className="eyebrow">친구 위치</p>
        <h1>도착 정보</h1>
        <p>도착 시간과 위치 업데이트를 여기에서 보여줄 예정입니다.</p>
      </section>

      <section className="map-placeholder" aria-label="지도 자리">
        <div className="vehicle-marker">
          <MapPin size={28} aria-hidden="true" />
        </div>
      </section>

      <footer className="bottom-panel">
        <p>공유 코드: {code}</p>
        <p className="muted">마지막 업데이트를 기다리는 중</p>
      </footer>
    </main>
  );
}
