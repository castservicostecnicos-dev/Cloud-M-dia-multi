// Navigation & Device Back Button Handler
// Prevents accidental app exit on Android/PWA/mobile devices, ensures back button navigates internally and prompts before exiting.

type BackHandler = () => boolean;

const SESSION_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const handlersStack: BackHandler[] = [];
let exitPromptCallback: (() => void) | null = null;
let exitModalBackHandler: BackHandler | null = null;
let isInitialized = false;
let hasUserActivatedTrap = false;
let allowNextBrowserExit = false;
let startedAtRootOfHistory = false;
let trapSeq = 1;
let lastActivatedPushAt = 0;

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

function hasRealUserActivation(): boolean {
  if (typeof navigator === 'undefined') return true;
  const nav = navigator as Navigator & {
    userActivation?: { isActive: boolean; hasBeenActive: boolean };
  };
  if (nav.userActivation && typeof nav.userActivation.isActive === 'boolean') {
    return nav.userActivation.isActive;
  }
  return true;
}

function isOwnSessionState(state: any): boolean {
  return Boolean(state && state.sessionId === SESSION_ID);
}

function getCurrentDepth(): number {
  if (typeof window === 'undefined') return 0;
  const s = window.history.state;
  if (isOwnSessionState(s) && typeof s.depth === 'number') return s.depth;
  return 0;
}

function ensureBaseHistoryState() {
  if (typeof window === 'undefined') return;
  try {
    const state = window.history.state;
    if (!isOwnSessionState(state) || (!state.appBase && !state.appTrap)) {
      window.history.replaceState(
        { appBase: true, depth: 0, sessionId: SESSION_ID },
        '',
        window.location.href
      );
    }
  } catch {}
}

function pushActivatedTrapState() {
  if (typeof window === 'undefined' || allowNextBrowserExit) return;

  // CRITICAL: Never call history.pushState without genuine transient user activation.
  // In Chromium's History Manipulation Intervention, ANY unactivated pushState marks the
  // current/base entry as skippable, causing the Android Back button to skip right past our
  // app without firing popstate!
  if (!hasRealUserActivation()) {
    return;
  }

  try {
    ensureBaseHistoryState();

    const currentState = window.history.state;
    const isOwnTrap = isOwnSessionState(currentState) && Boolean(currentState.appTrap);
    const isActivated = isOwnSessionState(currentState) && Boolean(currentState.activated);
    const currentDepth = getCurrentDepth();
    const now = Date.now();

    const needsPrimaryActivation = !hasUserActivatedTrap || !isOwnTrap || !isActivated;
    // Maintain up to 3 activated trap levels across distinct gestures so consecutive Back
    // presses (e.g. close modal -> leave sub-tab -> show exit prompt) all fire popstate.
    const canAddCushion =
      isOwnTrap &&
      isActivated &&
      currentDepth < 3 &&
      now - lastActivatedPushAt >= 180;

    if (needsPrimaryActivation || canAddCushion) {
      window.history.pushState(
        {
          appTrap: true,
          seq: trapSeq++,
          depth: currentDepth + 1,
          activated: true,
          sessionId: SESSION_ID,
          ts: now,
        },
        '',
        window.location.href
      );
      hasUserActivatedTrap = true;
      lastActivatedPushAt = now;
    }
  } catch {}
}

export function allowAppExitAndGoBack() {
  if (typeof window === 'undefined') return;
  allowNextBrowserExit = true;
  hasUserActivatedTrap = false;

  const currentDepth = getCurrentDepth();
  const stepsBack = Math.max(1, currentDepth + 1);

  try {
    if (startedAtRootOfHistory) {
      // Standalone PWA or fresh tab with no prior history entry before appBase
      if (currentDepth > 0 && window.history.length > currentDepth) {
        window.history.go(-currentDepth);
      }
      window.close();
    } else if (window.history.length > stepsBack) {
      window.history.go(-stepsBack);
    } else {
      window.close();
      if (window.history.length > 1) {
        window.history.go(-(window.history.length - 1));
      }
    }
  } catch {
    try {
      window.history.back();
    } catch {}
  }

  setTimeout(() => {
    allowNextBrowserExit = false;
    hasUserActivatedTrap = false;
  }, 600);
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

  // Record whether this tab/PWA started with no preceding browser history BEFORE pushing any traps
  startedAtRootOfHistory = window.history.length <= 1;

  // Tag the base entry via replaceState only (replaceState never triggers Chromium's intervention)
  ensureBaseHistoryState();

  const armOnUserGesture = (e: Event) => {
    if (allowNextBrowserExit) return;
    const target = e.target as HTMLElement | null;
    if (target && typeof target.closest === 'function' && target.closest('[data-no-back-trap="true"]')) {
      return;
    }
    pushActivatedTrapState();
  };

  const handlePopState = () => {
    if (allowNextBrowserExit) return;

    const landedState = window.history.state;
    const landedOnActivatedTrap = Boolean(
      isOwnSessionState(landedState) && landedState.appTrap && landedState.activated
    );

    // Do NOT push an unactivated trap inside popstate (that would mark landedState skippable
    // under Chromium's History Manipulation Intervention). Instead, the user's next tap
    // ("Continuar no App", closing toast, etc.) will immediately re-arm with user activation.
    hasUserActivatedTrap = landedOnActivatedTrap;

    dispatchBackAction();
  };

  const handlePageShow = () => {
    if (allowNextBrowserExit) return;
    const currentState = window.history.state;
    hasUserActivatedTrap = Boolean(
      isOwnSessionState(currentState) && currentState.appTrap && currentState.activated
    );
    ensureBaseHistoryState();
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

  window.addEventListener('pointerup', armOnUserGesture, { capture: true, passive: true });
  window.addEventListener('touchend', armOnUserGesture, { capture: true, passive: true });
  window.addEventListener('click', armOnUserGesture, { capture: true, passive: true });
  window.addEventListener('keydown', armOnUserGesture, { capture: true, passive: true });
  window.addEventListener('submit', armOnUserGesture, { capture: true, passive: true });
  window.addEventListener('popstate', handlePopState);
  window.addEventListener('pageshow', handlePageShow);
  window.addEventListener('keydown', handleKeyDown, { capture: true });
}
