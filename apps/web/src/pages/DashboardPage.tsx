import { FormEvent, useMemo, useState } from "react";
import {
  Clock,
  Copy,
  MapPin,
  MessageCircle,
  Plus,
  Radio,
  Search,
  Share2,
  Square,
  Trash2,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "../components/ui/button";
import { searchNaverPlaces, type NaverPlace } from "../features/naver/naverApi";
import {
  buildShareHandoff,
  formatShareTimeRemaining,
} from "../features/shareSessions/shareHandoff";
import {
  createShareSession,
  deleteShareSession,
  listShareSessions,
  stopShareSession,
  type OwnerShareSession,
} from "../features/shareSessions/shareSessionsApi";

export function DashboardPage() {
  const queryClient = useQueryClient();
  const [sessionName, setSessionName] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [pinCode, setPinCode] = useState("");
  const [destinationQuery, setDestinationQuery] = useState("");
  const [destinationResultQuery, setDestinationResultQuery] = useState("");
  const [selectedDestination, setSelectedDestination] = useState<NaverPlace | null>(null);
  const sessionsQuery = useQuery({
    queryKey: ["share-sessions"],
    queryFn: listShareSessions,
  });
  const createMutation = useMutation({
    mutationFn: createShareSession,
    onSuccess() {
      setSessionName("");
      setPinCode("");
      setDestinationQuery("");
      setDestinationResultQuery("");
      setSelectedDestination(null);
      queryClient.invalidateQueries({ queryKey: ["share-sessions"] });
    },
  });
  const destinationSearchMutation = useMutation({
    mutationFn: searchNaverPlaces,
    onSuccess(_places, query) {
      setDestinationResultQuery(query);
    },
  });
  const stopMutation = useMutation({
    mutationFn: stopShareSession,
    onSuccess() {
      queryClient.invalidateQueries({ queryKey: ["share-sessions"] });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: deleteShareSession,
    onSuccess() {
      queryClient.invalidateQueries({ queryKey: ["share-sessions"] });
    },
  });
  const { activeSessions, pastSessions } = useMemo(() => {
    const sessions = sessionsQuery.data ?? [];

    return {
      activeSessions: sessions.filter((session) => session.status === "active"),
      pastSessions: sessions.filter((session) => session.status !== "active"),
    };
  }, [sessionsQuery.data]);

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createMutation.mutate({
      sessionName,
      durationMinutes,
      ...(pinCode ? { pinCode } : {}),
      ...(selectedDestination
        ? {
            destinationName: selectedDestination.name,
            destinationLat: selectedDestination.lat,
            destinationLng: selectedDestination.lng,
          }
        : {}),
    });
  }

  function handleDestinationSearch() {
    setSelectedDestination(null);
    destinationSearchMutation.mutate(destinationQuery);
  }

  function handleDelete(session: OwnerShareSession) {
    if (window.confirm("이 위치 공유를 삭제할까요?")) {
      deleteMutation.mutate(session.id);
    }
  }

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
        <form className="share-create-form" onSubmit={handleCreate}>
          <label>
            공유 이름
            <input
              onChange={(event) => setSessionName(event.target.value)}
              placeholder="예: 퇴근길, 공항 픽업"
              required
              type="text"
              value={sessionName}
            />
          </label>
          <label>
            공유 시간
            <select
              onChange={(event) => setDurationMinutes(Number(event.target.value))}
              value={durationMinutes}
            >
              <option value={30}>30분</option>
              <option value={60}>1시간</option>
              <option value={120}>2시간</option>
              <option value={240}>4시간</option>
            </select>
          </label>
          <label>
            목적지
            <input
              onChange={(event) => {
                setDestinationQuery(event.target.value);
                setDestinationResultQuery("");
                setSelectedDestination(null);
              }}
              placeholder="예: 강남역, 김포공항"
              type="text"
              value={destinationQuery}
            />
          </label>
          <Button
            className="secondary-action"
            disabled={destinationQuery.trim().length < 2 || destinationSearchMutation.isPending}
            onClick={handleDestinationSearch}
            type="button"
            variant="secondary"
          >
            <Search size={18} aria-hidden="true" />
            목적지 검색
          </Button>
          {destinationResultQuery === destinationQuery && destinationSearchMutation.data?.length ? (
            <div className="destination-results" aria-label="목적지 검색 결과">
              {destinationSearchMutation.data.map((place) => (
                <button
                  className={
                    selectedDestination?.lat === place.lat &&
                    selectedDestination.lng === place.lng
                      ? "destination-result destination-result--selected"
                      : "destination-result"
                  }
                  key={`${place.lat}:${place.lng}:${place.name}`}
                  onClick={() => {
                    setSelectedDestination(place);
                    setDestinationQuery(place.name);
                  }}
                  type="button"
                >
                  <MapPin size={18} aria-hidden="true" />
                  <span>
                    <strong>{place.name}</strong>
                    <small>{place.roadAddress ?? place.address}</small>
                  </span>
                </button>
              ))}
            </div>
          ) : null}
          {selectedDestination ? (
            <p className="destination-selected">
              선택한 목적지: {selectedDestination.name}
            </p>
          ) : null}
          <label>
            PIN 코드 (선택)
            <input
              autoComplete="one-time-code"
              inputMode="numeric"
              maxLength={4}
              onChange={(event) => setPinCode(event.target.value.replace(/\D/g, ""))}
              pattern="[0-9]*"
              placeholder="1234"
              type="text"
              value={pinCode}
            />
          </label>
          <Button
            className="primary-action"
            type="submit"
            size="wide"
            disabled={createMutation.isPending}
          >
            <Plus size={22} aria-hidden="true" />
            공유 시작
          </Button>
        </form>
      </section>

      <section className="empty-state" aria-label="위치 공유 목록">
        <div className="section-heading">
          <p className="eyebrow">공유 목록</p>
          {sessionsQuery.isLoading ? <p className="muted">불러오는 중...</p> : null}
        </div>

        {sessionsQuery.isError ? (
          <p>위치 공유 목록을 불러오지 못했습니다.</p>
        ) : (
          <>
            <SessionGroup
              title={`공유 중 (${activeSessions.length})`}
              sessions={activeSessions}
              onDelete={handleDelete}
              onStop={(session) => stopMutation.mutate(session.id)}
            />
            <SessionGroup
              title={`지난 공유 (${pastSessions.length})`}
              sessions={pastSessions}
              onDelete={handleDelete}
            />
          </>
        )}
      </section>
    </main>
  );
}

function SessionGroup({
  title,
  sessions,
  onDelete,
  onStop,
}: {
  title: string;
  sessions: OwnerShareSession[];
  onDelete: (session: OwnerShareSession) => void;
  onStop?: (session: OwnerShareSession) => void;
}) {
  return (
    <section className="session-group" aria-label={title}>
      <h2>{title}</h2>
      {sessions.length === 0 ? (
        <p className="muted">아직 표시할 위치 공유가 없습니다.</p>
      ) : (
        <div className="session-list">
          {sessions.map((session) => (
            <article className="session-card" key={session.id}>
              <div className="session-card__main">
                <h3>{session.sessionName}</h3>
                <p className="muted">
                  <Clock size={16} aria-hidden="true" />
                  {formatSessionStatus(session)}
                </p>
                {session.destinationName ? (
                  <p className="session-card__destination">
                    <MapPin size={16} aria-hidden="true" />
                    {session.destinationName}
                  </p>
                ) : null}
                <p className="session-code">
                  <Copy size={16} aria-hidden="true" />
                  {session.sessionCode}
                  {session.hasPin ? <span>PIN 보호됨</span> : null}
                </p>
              </div>
              {session.status === "active" ? <ShareHandoffPanel session={session} /> : null}
              <div className="session-actions">
                {onStop && session.status === "active" ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => onStop(session)}
                  >
                    <Square size={16} aria-hidden="true" />
                    공유 중지
                  </Button>
                ) : null}
                <Button type="button" variant="ghost" onClick={() => onDelete(session)}>
                  <Trash2 size={16} aria-hidden="true" />
                  삭제
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function ShareHandoffPanel({ session }: { session: OwnerShareSession }) {
  const [feedback, setFeedback] = useState("");
  const handoff = buildShareHandoff({
    session,
    origin: window.location.origin,
  });

  async function copyToClipboard(value: string, successMessage: string) {
    if (!navigator.clipboard?.writeText) {
      setFeedback("이 브라우저에서는 직접 복사할 수 없습니다.");
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setFeedback(successMessage);
    } catch {
      setFeedback("복사하지 못했습니다. 링크를 길게 눌러 복사해 주세요.");
    }
  }

  async function handleNativeShare() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: handoff.title,
          text: handoff.message,
          url: handoff.trackingUrl,
        });
        setFeedback("공유 앱을 열었어요.");
        return;
      } catch {
        setFeedback("공유를 취소했거나 열지 못했습니다.");
        return;
      }
    }

    await copyToClipboard(handoff.message, "메시지를 복사했어요. 카카오톡에 붙여넣어 주세요.");
  }

  return (
    <div className="share-handoff" aria-label={`${session.sessionName} 공유 보내기`}>
      <div className="share-handoff__preview">
        <p className="eyebrow">친구에게 보낼 메시지</p>
        <pre>{handoff.message}</pre>
      </div>
      <div className="share-handoff__actions">
        <Button type="button" variant="secondary" onClick={() => void handleNativeShare()}>
          <Share2 size={16} aria-hidden="true" />
          카카오톡 또는 공유 앱 열기
        </Button>
        <Button asChild variant="secondary">
          <a href={handoff.smsHref}>
            <MessageCircle size={16} aria-hidden="true" />
            문자로 보내기
          </a>
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => void copyToClipboard(handoff.trackingUrl, "링크를 복사했어요.")}
        >
          <Copy size={16} aria-hidden="true" />
          링크 복사
        </Button>
      </div>
      <p className="share-handoff__hint">
        휴대폰 공유 시트에서 카카오톡을 선택할 수 있어요.
      </p>
      <p className="share-handoff__feedback" aria-live="polite">
        {feedback}
      </p>
    </div>
  );
}

function formatSessionStatus(session: OwnerShareSession) {
  if (session.status === "stopped") {
    return "공유 중지됨";
  }

  if (session.status === "expired") {
    return "만료됨";
  }

  return `공유 중 · 약 ${formatShareTimeRemaining(session.expiresAt)} 남음`;
}
