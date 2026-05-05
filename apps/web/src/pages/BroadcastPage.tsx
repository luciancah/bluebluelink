import { Radio, Square } from "lucide-react";
import { useParams } from "react-router-dom";
import { SharedMap } from "../components/map/SharedMap";
import { Button } from "../components/ui/button";
import {
  useLocationBroadcast,
  type BroadcastStatus,
} from "../features/broadcast/useLocationBroadcast";

export function BroadcastPage() {
  const { id } = useParams<{ id: string }>();
  const broadcast = useLocationBroadcast(id);
  const statusCopy = getBroadcastStatusCopy(broadcast.status);

  return (
    <main className="live-shell">
      <header className="live-header">
        <div>
          <h1>위치 공유 중</h1>
          <p>{statusCopy.description}</p>
        </div>
        <Radio className="status-icon" size={28} aria-label="공유 중" />
      </header>

      <SharedMap isStale={broadcast.status === "delayed" || broadcast.status === "background"} />

      <footer className="bottom-panel broadcast-panel">
        <div className="broadcast-panel__summary">
          <div>
            <p>공유 코드: {id}</p>
            <p className="muted">{statusCopy.label}</p>
          </div>
          <div className="broadcast-contract" role="note">
            <p>앱을 열어두는 동안만 위치가 전송됩니다.</p>
            <p>화면을 잠그거나 앱을 닫으면 업데이트가 멈출 수 있습니다.</p>
          </div>
        </div>
        <div className="broadcast-actions">
          <Button
            className="primary-action"
            type="button"
            onClick={() => void broadcast.start()}
            disabled={broadcast.status === "gps-checking" || broadcast.status === "sending"}
          >
            위치 전송 시작
          </Button>
          <Button
            className="secondary-action"
            type="button"
            variant="secondary"
            onClick={() => void broadcast.stop()}
          >
            <Square size={18} aria-hidden="true" />
            공유 중지
          </Button>
        </div>
      </footer>
    </main>
  );
}

function getBroadcastStatusCopy(status: BroadcastStatus) {
  switch (status) {
    case "gps-checking":
      return {
        label: "위치 확인 중",
        description: "위치 권한과 현재 위치 신호를 확인하고 있습니다.",
      };
    case "sending":
      return {
        label: "위치 전송 중",
        description: "확인한 위치를 친구에게 전송하고 있습니다.",
      };
    case "sent":
      return {
        label: "방금 전송됨",
        description: "친구가 최신 위치를 볼 수 있습니다.",
      };
    case "delayed":
      return {
        label: "업데이트 지연",
        description: "네트워크 문제로 위치 전송이 늦어지고 있습니다.",
      };
    case "background":
      return {
        label: "앱이 백그라운드에 있습니다",
        description: "앱이 다시 열리면 최신 위치를 다시 전송합니다.",
      };
    case "denied":
      return {
        label: "위치 권한이 필요합니다",
        description: "브라우저 설정에서 위치 권한을 허용해 주세요.",
      };
    case "unavailable":
      return {
        label: "위치를 사용할 수 없습니다",
        description: "이 기기에서 현재 위치를 확인하지 못했습니다.",
      };
    case "insecure":
      return {
        label: "HTTPS 연결이 필요합니다",
        description: "위치 공유는 안전한 연결에서만 시작할 수 있습니다.",
      };
    case "stopped":
      return {
        label: "공유 종료됨",
        description: "위치 전송이 중지되었습니다.",
      };
    case "idle":
    default:
      return {
        label: "위치 확인 전",
        description: "위치 전송 시작을 누르면 공유가 시작됩니다.",
      };
  }
}
