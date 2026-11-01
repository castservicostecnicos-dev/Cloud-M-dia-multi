// Navigation & Device Back Button Handler
// Prevents accidental app exit on Android/PWA/mobile devices, ensures back button navigates internally and prompts before exiting.

type BackHandler = () => boolean;

const handlersStack: BackHandler[] = [];
let exitPromptCallback: (() => void) | null = null;
let isInitialized = false;

export function registerBackHandler(handler: BackHandler): () => void {
  handlersStack.push(handler);
  return () => {
    const idx = handlersStack.indexOf(handler);
    if (idx !== -1) handlersStack.splice(idx, 1);
  };
}

export function setExitPromptCallback(cb: (() => void) | null) {
  exitPromptCallback = cb;
}

export function initDeviceBackNavigation() {
  if (typeof window === 'undefined' || isInitialized) return;
  isInitialized = true;

  // Push an initial history trap so the browser/Android back button triggers popstate instead of exiting
  try {
    window.history.pushState({ appTrap: true, ts: Date.now() }, '', window.location.href);
  } catch {}

  const handlePopState = () => {
    // Always re-arm the history trap immediately to keep the app inside the shell
    try {
      window.history.pushState({ appTrap: true, ts: Date.now() }, '', window.location.href);
    } catch {}

    // Check if any registered handlers (e.g. open modals, drawer, sub-views) can handle the back action
    for (let i = handlersStack.length - 1; i >= 0; i--) {
      const handler = handlersStack[i];
      if (typeof handler === 'function') {
        const handled = handler();
        if (handled) {
          return;
        }
      }
    }

    // If nothing in the stack handled the back button, ask user if they want to exit
    if (exitPromptCallback) {
      exitPromptCallback();
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    // Android TV Back Key (keyCode 4), Escape (keyCode 27), Browser Back (keyCode 8 if not input)
    if (e.key === 'Escape' || e.keyCode === 27 || e.keyCode === 4) {
      for (let i = handlersStack.length - 1; i >= 0; i--) {
        const handler = handlersStack[i];
        if (typeof handler === 'function') {
          const handled = handler();
          if (handled) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
        }
      }

      if (exitPromptCallback) {
        e.preventDefault();
        e.stopPropagation();
        exitPromptCallback();
      }
    }
  };

  window.addEventListener('popstate', handlePopState);
  window.addEventListener('keydown', handleKeyDown);
}
