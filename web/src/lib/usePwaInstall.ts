import { useEffect, useState } from "react";

/** Chrome/Android fires this before showing its native install prompt. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** True when the app runs as an installed PWA (standalone) rather than a tab. */
function detectStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari uses a non-standard navigator flag.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function detectIOS(): boolean {
  const ua = window.navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua);
}

/**
 * PWA install state:
 *  - `isStandalone` — already installed/running as an app → hide any nudge.
 *  - `canInstall`   — Chrome/Android offered a native prompt we can trigger.
 *  - `isIOS`        — Safari has no prompt API; we show manual instructions.
 */
export function usePwaInstall() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(detectStandalone);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault(); // keep it from auto-showing; we drive it from the banner
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setDeferred(null);
      setIsStandalone(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    const mq = window.matchMedia("(display-mode: standalone)");
    const onModeChange = () => setIsStandalone(detectStandalone());
    mq.addEventListener?.("change", onModeChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      mq.removeEventListener?.("change", onModeChange);
    };
  }, []);

  const promptInstall = async (): Promise<boolean> => {
    if (!deferred) return false;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    return outcome === "accepted";
  };

  return {
    isStandalone,
    canInstall: Boolean(deferred),
    isIOS: detectIOS(),
    promptInstall,
  };
}
