export type AuthUser = {
  id: string;
  email: string;
};

type AuthResponse = {
  user: AuthUser;
};

export async function getCurrentUser(): Promise<AuthUser | null> {
  const response = await fetch("/api/auth/me", {
    credentials: "include",
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error("Failed to load current user");
  }

  const data = (await response.json()) as AuthResponse;
  return data.user;
}

export async function login(input: { email: string; password: string }): Promise<AuthUser> {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error("Invalid credentials");
  }

  const data = (await response.json()) as AuthResponse;
  return data.user;
}
