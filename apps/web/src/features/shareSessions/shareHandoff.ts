import type { OwnerShareSession } from "./shareSessionsApi";

export type ShareHandoff = {
  title: string;
  trackingUrl: string;
  message: string;
  smsHref: string;
};

export function buildShareHandoff({
  session,
  origin,
  now = new Date(),
}: {
  session: OwnerShareSession;
  origin: string;
  now?: Date;
}): ShareHandoff {
  const trackingUrl = `${origin.replace(/\/$/, "")}/track/${session.sessionCode}`;
  const title = "진형링크 위치 공유";
  const lines = [
    "진형링크로 위치를 공유합니다.",
    session.sessionName,
    session.destinationName ? `목적지: ${session.destinationName}` : null,
    "도착 전까지 실시간 위치를 확인해 주세요.",
    `공유 시간: 약 ${formatShareTimeRemaining(session.expiresAt, now)} 남음`,
    trackingUrl,
  ].filter(Boolean);
  const message = lines.join("\n");

  return {
    title,
    trackingUrl,
    message,
    smsHref: `sms:?&body=${encodeURIComponent(message)}`,
  };
}

export function formatShareTimeRemaining(expiresAt: string, now = new Date()) {
  const expiresAtTime = new Date(expiresAt).getTime();
  const remainingMinutes = Math.max(1, Math.ceil((expiresAtTime - now.getTime()) / 60_000));
  const hours = Math.floor(remainingMinutes / 60);
  const minutes = remainingMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours}시간 ${minutes}분`;
  }

  if (hours > 0) {
    return `${hours}시간`;
  }

  return `${remainingMinutes}분`;
}
