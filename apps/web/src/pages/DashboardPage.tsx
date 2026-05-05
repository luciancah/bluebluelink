import { FormEvent, useMemo, useState } from "react";
import { Clock, Copy, MapPin, Plus, Radio, Search, Square, Trash2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "../components/ui/button";
import { searchNaverPlaces, type NaverPlace } from "../features/naver/naverApi";
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
              inputMode="numeric"
              maxLength={4}
              onChange={(event) => setPinCode(event.target.value.replace(/\D/g, ""))}
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
              <div>
                <h3>{session.sessionName}</h3>
                <p className="muted">
                  <Clock size={16} aria-hidden="true" />
                  {formatSessionStatus(session)}
                </p>
                <p className="session-code">
                  <Copy size={16} aria-hidden="true" />
                  {session.sessionCode}
                  {session.hasPin ? <span>PIN 보호됨</span> : null}
                </p>
              </div>
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

function formatSessionStatus(session: OwnerShareSession) {
  if (session.status === "stopped") {
    return "공유 중지됨";
  }

  if (session.status === "expired") {
    return "만료됨";
  }

  return "공유 중";
}
