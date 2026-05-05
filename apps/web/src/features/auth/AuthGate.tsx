import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { getCurrentUser, type AuthUser } from "./authApi";
import { LoginPage } from "./LoginPage";

type AuthGateProps = {
  children: ReactNode;
};

export function AuthGate({ children }: AuthGateProps) {
  const queryClient = useQueryClient();
  const currentUser = useQuery({
    queryKey: ["auth", "me"],
    queryFn: getCurrentUser,
    retry: false,
  });

  function handleLoginSuccess(user: AuthUser) {
    queryClient.setQueryData(["auth", "me"], user);
  }

  if (currentUser.isLoading) {
    return (
      <main className="app-shell">
        <p className="muted">로그인 확인 중...</p>
      </main>
    );
  }

  if (!currentUser.data) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return children;
}
