// Navigation & Device Back Button Handler
// Prevents accidental app exit on Android/PWA/mobile devices, ensures back button navigates internally and prompts before exiting.

type BackHandler = () => boolean;

const handlersStack: BackHandler[] = [];
let exitPromptCallback: (() => void) | null = null;
let exitModalBackHandler: BackHandler | null = null;
let isInitialized = false;
let hasUserActivatedTrap = false;
let allowNextBrowserExit = false;
let trapSeq = 1;

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

export function setExitModalBackHandler(handler: BackHandler | null) {
  exitModalBackHandler = handler;
}

function pushTrapState(fromUserGesture = false) {
  if (typeof window === 'undefined' || allowNextBrowserExit) return;
  try {
    // Only replace base once if not yet tagged
    if (!window.history.state || (!window.history.state.appBase && !window.history.state.appTrap)) {
      window.history.replaceState({ appBase: true }, '', window.location.href);
    }
    if (!window.history.state?.appTrap || (fromUserGesture && !hasUserActivatedTrap)) {
      window.history.pushState(
        { appTrap: true, seq: trapSeq++, activated: fromUserGesture, ts: Date.now() },
        '',
        window.location.href
      );
      if (fromUserGesture) {
        hasUserActivatedTrap = true;
      }
    }
  } catch {}
}

export function allowAppExitAndGoBack() {
  if (typeof window === 'undefined') return;
  allowNextBrowserExit = true;
  try {
    if (window.history.length > 1) {
      window.history.go(-2);
    }
  } catch {
    try {
      window.history.back();
    } catch {}
  }
  setTimeout(() => {
    allowNextBrowserExit = false;
    hasUserActivatedTrap = false;
    pushTrapState(false);
  }, 500);
}

function isEditableElement(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return false;
}

function dispatchBackAction(): boolean {
  if (exitModalBackHandler && exitModalBackHandler()) {
    return true;
  }

  for (let i = handlersStack.length - 1; i >= 0; i--) {
    const handler = handlersStack[i];
    if (typeof handler === 'function') {
      const handled = handler();
      if (handled) {
        return true;
      }
    }
  }

  if (exitPromptCallback) {
    exitPromptCallback();
    return true;
  }

  return false;
}

export function initDeviceBackNavigation() {
  if (typeof window === 'undefined' || isInitialized) return;
  isInitialized = true;

  // Initial trap on mount
  pushTrapState(false);

  // Re-arm trap inside real user gestures so Android Chrome's History Manipulation Intervention
  // never skips our history entry when the hardware Back button is pressed.
  const armOnUserGesture = () => {
    if (allowNextBrowserExit) return;
    if (!hasUserActivatedTrap || !window.history.state?.appTrap) {
      pushTrapState(true);
    }
  };

  const handlePopState = () => {
    if (allowNextBrowserExit) return;

    // Force immediate re-arming and require fresh user-activated push on next tap
    hasUserActivatedTrap = false;
    try {
      window.history.pushState(
        { appTrap: true, seq: trapSeq++, activated: false, ts: Date.now() },
        '',
        window.location.href
      );
    } catch {}

    dispatchBackAction();
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    const isBrowserBackKey =
      e.key === 'GoBack' ||
      e.key === 'BrowserBack' ||
      e.key === 'Back' ||
      e.keyCode === 4 ||
      e.keyCode === 166 ||
      e.keyCode === 10009;

    const isEscapeKey = e.key === 'Escape' || e.keyCode === 27;
    const isBackspaceAsBack =
      (e.key === 'Backspace' || e.keyCode === 8) && !isEditableElement(e.target);

    if (isBrowserBackKey || isEscapeKey || isBackspaceAsBack) {
      if (dispatchBackAction()) {
        e.preventDefault();
        e.stopPropagation();
      }
    }
  };

  window.addEventListener('pointerdown', armOnUserGesture, { capture: true, passive: true });
  window.addEventListener('touchstart', armOnUserGesture, { capture: true, passive: true });
  window.addEventListener('click', armOnUserGesture, { capture: true, passive: true });
  window.addEventListener('keydown', armOnUserGesture, { capture: true, passive: true });
  window.addEventListener('popstate', handlePopState);
  window.addEventListener('keydown', handleKeyDown, { capture: true });
}
