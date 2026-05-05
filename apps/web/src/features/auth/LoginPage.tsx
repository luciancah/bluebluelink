import { FormEvent, useState } from "react";
import { Button } from "../../components/ui/button";
import { login, type AuthUser } from "./authApi";

type LoginPageProps = {
  onLoginSuccess: (user: AuthUser) => void;
};

export function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const user = await login({ email, password });
      onLoginSuccess(user);
    } catch {
      setError("이메일 또는 비밀번호가 올바르지 않습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="app-shell auth-shell">
      <section className="auth-panel" aria-labelledby="login-title">
        <p className="eyebrow">진형링크</p>
        <h1 id="login-title">로그인</h1>
        <p>내 위치 공유를 만들고 관리하려면 먼저 로그인해 주세요.</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            이메일
            <input
              autoComplete="email"
              inputMode="email"
              name="email"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>

          <label>
            비밀번호
            <input
              autoComplete="current-password"
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>

          {error ? <p className="form-error">{error}</p> : null}

          <Button size="wide" type="submit" disabled={isSubmitting}>
            로그인
          </Button>
        </form>
      </section>
    </main>
  );
}
