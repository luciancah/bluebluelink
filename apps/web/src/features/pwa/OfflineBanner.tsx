import { useEffect, useState } from "react";

export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    function syncOnlineStatus() {
      setIsOnline(navigator.onLine);
    }

    window.addEventListener("online", syncOnlineStatus);
    window.addEventListener("offline", syncOnlineStatus);

    return () => {
      window.removeEventListener("online", syncOnlineStatus);
      window.removeEventListener("offline", syncOnlineStatus);
    };
  }, []);

  if (isOnline) {
    return null;
  }

  return (
    <div className="offline-banner" role="status">
      오프라인입니다. 실시간 위치와 경로는 연결되면 다시 업데이트됩니다.
    </div>
  );
}
