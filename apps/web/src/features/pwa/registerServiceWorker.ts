type RegisterServiceWorkerOptions = {
  enabled?: boolean;
  logger?: Pick<Console, "warn">;
  scriptUrl?: string;
  serviceWorker?: Pick<ServiceWorkerContainer, "register">;
  win?: Pick<Window, "addEventListener">;
};

export function registerServiceWorker({
  enabled = import.meta.env.PROD,
  logger = console,
  scriptUrl = "/sw.js",
  serviceWorker = navigator.serviceWorker,
  win = window,
}: RegisterServiceWorkerOptions = {}) {
  if (!enabled || !serviceWorker) {
    return;
  }

  win.addEventListener("load", () => {
    serviceWorker.register(scriptUrl, { scope: "/" }).catch((error: unknown) => {
      logger.warn("Service worker registration failed", error);
    });
  });
}
