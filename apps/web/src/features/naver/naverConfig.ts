type NaverMapsClientEnv = {
  [key: string]: unknown;
  VITE_NAVER_MAPS_CLIENT_ID?: string;
};

export function getNaverMapsClientConfig(
  env: NaverMapsClientEnv = import.meta.env as NaverMapsClientEnv,
) {
  const clientId =
    typeof env.VITE_NAVER_MAPS_CLIENT_ID === "string"
      ? env.VITE_NAVER_MAPS_CLIENT_ID
      : "";

  return {
    clientId,
    enabled: clientId.length > 0,
  };
}
