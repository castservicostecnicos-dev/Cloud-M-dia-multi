import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { getCachedIndexedDbMediaSync, getIndexedDbMedia } from './indexedDbMedia';

// Firebase Auth configuration for Google Drive OAuth
const firebaseAuthConfig = {
  projectId: firebaseConfig.projectId,
  appId: firebaseConfig.appId,
  apiKey: firebaseConfig.apiKey,
  authDomain: firebaseConfig.authDomain,
  storageBucket: firebaseConfig.storageBucket,
  messagingSenderId: firebaseConfig.messagingSenderId,
  oAuthClientId: firebaseConfig.oAuthClientId,
};

const oauthAppName = 'google-drive-oauth-client';
const existingOauthApp = getApps().find((a) => a.name === oauthAppName);
const app = existingOauthApp
  ? existingOauthApp
  : initializeApp(firebaseAuthConfig, oauthAppName);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
// Google Drive scope for file & folder creation/management
provider.addScope('https://www.googleapis.com/auth/drive.file');
provider.setCustomParameters({
  prompt: 'select_account',
});

// Flag to track ongoing sign in flow
let isSigningIn = false;

const STORAGE_TOKEN_KEY = 'mindoors_gdrive_access_token';
const STORAGE_EXPIRY_KEY = 'mindoors_drive_token_expiry';
const STORAGE_EMAIL_KEY = 'mindoors_drive_account_email';
const STORAGE_NAME_KEY = 'mindoors_drive_account_name';

export const isRealOAuthToken = (token?: string | null): boolean => {
  if (!token || typeof token !== 'string') return false;
  const trimmed = token.trim();
  if (
    trimmed === 'cast-persistent-drive-session' ||
    trimmed.startsWith('fake') ||
    trimmed.length < 20
  ) {
    return false;
  }
  return true;
};

// Auto-hydrate access token and expiry from localStorage so session is retained if real
let cachedAccessToken: string | null = (() => {
  try {
    const t = localStorage.getItem(STORAGE_TOKEN_KEY) || localStorage.getItem('google_drive_access_token') || null;
    if (t && !isRealOAuthToken(t)) {
      localStorage.removeItem(STORAGE_TOKEN_KEY);
      localStorage.removeItem('google_drive_access_token');
      return null;
    }
    return t;
  } catch {
    return null;
  }
})();

let cachedTokenExpiry: number | null = (() => {
  try {
    const exp = localStorage.getItem(STORAGE_EXPIRY_KEY);
    return exp ? Number(exp) : (cachedAccessToken && isRealOAuthToken(cachedAccessToken) ? Date.now() + 3600 * 1000 : null);
  } catch {
    return null;
  }
})();

export const setCachedAccessToken = (token: string | null, expiry?: number | null) => {
  if (!token || !isRealOAuthToken(token)) {
    cachedAccessToken = null;
    cachedTokenExpiry = null;
    try {
      localStorage.removeItem(STORAGE_TOKEN_KEY);
      localStorage.removeItem(STORAGE_EXPIRY_KEY);
      localStorage.removeItem('google_drive_access_token');
    } catch {}
  } else {
    cachedAccessToken = token;
    cachedTokenExpiry = expiry !== undefined && expiry !== null ? expiry : Date.now() + 3600 * 1000;
    try {
      localStorage.setItem(STORAGE_TOKEN_KEY, token);
      localStorage.setItem('google_drive_access_token', token);
      localStorage.setItem(STORAGE_EXPIRY_KEY, String(cachedTokenExpiry));
    } catch {}
  }
};

export const isTokenExpired = (): boolean => {
  if (!cachedAccessToken || !isRealOAuthToken(cachedAccessToken)) return true;
  if (!cachedTokenExpiry) return false;
  return Date.now() >= cachedTokenExpiry;
};

export interface DriveAccountInfo {
  email: string;
  name: string;
  photoUrl?: string;
  uid: string;
}

export interface DriveFolderResult {
  id: string;
  name: string;
  webViewLink?: string;
}

export interface DriveUploadResult {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  webContentLink?: string;
  directStreamLink?: string;
  size?: number;
}

export interface ClientHierarchyStructure {
  rootFolder: DriveFolderResult;
  clientFolder: DriveFolderResult;
  categoryFolders: {
    photos: DriveFolderResult;
    documents: DriveFolderResult;
  };
}

/**
 * Initialize Auth State Listener
 * Carrega e emite imediatamente a conta configurada cast.servicostecnicos@gmail.com
 */
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  if (cachedAccessToken && isRealOAuthToken(cachedAccessToken) && !isTokenExpired()) {
    const savedUser: any = {
      email: localStorage.getItem(STORAGE_EMAIL_KEY) || 'cast.servicostecnicos@gmail.com',
      displayName: localStorage.getItem(STORAGE_NAME_KEY) || 'Conta Conectada',
      uid: 'gdrive-oauth-user',
    };
    setTimeout(() => {
      if (onAuthSuccess) onAuthSuccess(savedUser, cachedAccessToken!);
    }, 20);
  } else {
    setTimeout(() => {
      if (onAuthFailure) onAuthFailure();
    }, 20);
  }

  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user && cachedAccessToken && isRealOAuthToken(cachedAccessToken)) {
      if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
    } else if (!user && (!cachedAccessToken || !isRealOAuthToken(cachedAccessToken))) {
      if (onAuthFailure) onAuthFailure();
    }
  });
};

/**
 * Convert dataURL (base64) to Blob
 */
export const dataUrlToBlob = (dataUrl: string): Blob => {
  const arr = dataUrl.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
};

export const getDriveAuthFriendlyMessage = (error: any): string => {
  const code = error?.code || '';
  const message = error?.message || '';

  if (code === 'auth/popup-closed-by-user' || message.includes('popup-closed-by-user')) {
    return 'A janela do Google foi fechada antes de concluir o login.';
  }
  if (code === 'auth/popup-blocked' || message.includes('popup-blocked')) {
    return 'O navegador bloqueou a janela pop-up do Google. Permita pop-ups para este site e tente novamente.';
  }
  if (code === 'auth/cancelled-popup-request' || message.includes('cancelled-popup-request')) {
    return 'A solicitação de login foi cancelada.';
  }
  if (code === 'auth/unauthorized-domain' || message.includes('unauthorized-domain')) {
    return 'Domínio não autorizado no Firebase Authentication. Conectando via Google Identity Services...';
  }
  if (code === 'auth/network-request-failed') {
    return 'Erro de rede ao conectar com o Google. Verifique sua conexão com a internet.';
  }
  return message || 'Não foi possível conectar com o Google Drive.';
};

/**
 * Load Google Identity Services script if not already present
 */
const loadGoogleGsiScript = (): Promise<void> => {
  if (typeof window !== 'undefined' && (window as any).google?.accounts?.oauth2) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      return reject(new Error('Document not available.'));
    }
    const existing = document.querySelector('script[src*="accounts.google.com/gsi/client"]');
    if (existing) {
      if ((window as any).google?.accounts?.oauth2) {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Falha ao carregar Google Identity Services.')));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Falha ao carregar script do Google Identity Services.'));
    document.head.appendChild(script);
  });
};

/**
 * Direct Google OAuth 2.0 Sign-In via Google Identity Services (GIS).
 * Does not depend on Firebase Auth authorized domains, working seamlessly on any domain.
 */
export const googleSignInViaGsi = async (): Promise<{
  user: User;
  accessToken: string;
} | null> => {
  await loadGoogleGsiScript();
  const clientId = firebaseAuthConfig.oAuthClientId;

  return new Promise((resolve, reject) => {
    const win = window as any;
    if (!win.google?.accounts?.oauth2) {
      reject(new Error('Google Identity Services não está disponível no navegador.'));
      return;
    }

    try {
      const client = win.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope:
          'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
        prompt: 'select_account',
        callback: async (response: any) => {
          if (response.error) {
            if (response.error === 'access_denied') {
              console.warn('[GIS OAuth] Usuário cancelou ou fechou a janela do Google.');
              resolve(null);
              return;
            }
            reject(new Error(response.error_description || response.error));
            return;
          }

          if (!response.access_token) {
            reject(new Error('Nenhum token de acesso retornado pelo Google.'));
            return;
          }

          const token = response.access_token;
          cachedAccessToken = token;
          setCachedAccessToken(token, Date.now() + 3500 * 1000);

          // Retrieve user profile of the chosen account
          let userProfile: any = {
            email: '',
            displayName: '',
            photoURL: undefined,
            uid: 'gdrive-connected',
          };

          try {
            const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (profileRes.ok) {
              const pData = await profileRes.json();
              userProfile = {
                email: pData.email || '',
                displayName: pData.name || pData.email || 'Conta Google',
                photoURL: pData.picture,
                uid: pData.sub || 'gdrive-connected',
              };
            }
          } catch (profileErr) {
            console.warn('[GIS OAuth] Could not fetch user profile details:', profileErr);
          }

          // If email is still empty, call Drive About endpoint to get the chosen account email
          if (!userProfile.email) {
            try {
              const aRes = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
                headers: { Authorization: `Bearer ${token}` },
              });
              if (aRes.ok) {
                const aData = await aRes.json();
                if (aData.user) {
                  userProfile.email = aData.user.emailAddress || userProfile.email;
                  userProfile.displayName = aData.user.displayName || userProfile.displayName || aData.user.emailAddress;
                  userProfile.photoURL = aData.user.photoLink || userProfile.photoURL;
                }
              }
            } catch {}
          }

          resolve({ user: userProfile as User, accessToken: token });
        },
      });

      client.requestAccessToken({ prompt: 'select_account' });
    } catch (err: any) {
      reject(err);
    }
  });
};

/**
 * Validate and set manual Google Drive access token
 */
export const setManualDriveToken = async (
  token: string
): Promise<{ user: User; accessToken: string }> => {
  const clean = token.trim();
  if (!clean) {
    throw new Error('Informe um token de acesso válido.');
  }

  // Test token with Google Drive API
  const testRes = await fetch(`${DRIVE_API_BASE}?pageSize=1`, {
    headers: { Authorization: `Bearer ${clean}` },
  });

  if (!testRes.ok) {
    const errorData = await testRes.json().catch(() => ({}));
    throw new Error(
      errorData.error?.message ||
        `Token do Google Drive inválido ou expirado (status ${testRes.status}).`
    );
  }

  cachedAccessToken = clean;
  setCachedAccessToken(clean, Date.now() + 3500 * 1000);

  // Retrieve user profile if possible
  let userProfile: any = {
    email: 'cast.servicostecnicos@gmail.com',
    displayName: 'CAST Serviços Técnicos',
    uid: 'manual-token-user',
  };

  try {
    const pRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${clean}` },
    });
    if (pRes.ok) {
      const pData = await pRes.json();
      userProfile = {
        email: pData.email || userProfile.email,
        displayName: pData.name || pData.email || userProfile.displayName,
        photoURL: pData.picture,
        uid: pData.sub || 'manual-token-user',
      };
    }
  } catch {}

  try {
    const aRes = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
      headers: { Authorization: `Bearer ${clean}` },
    });
    if (aRes.ok) {
      const aData = await aRes.json();
      if (aData.user) {
        userProfile = {
          email: aData.user.emailAddress || userProfile.email,
          displayName: aData.user.displayName || userProfile.displayName,
          photoURL: aData.user.photoLink,
          uid: aData.user.permissionId || 'manual-token-user',
        };
      }
    }
  } catch {}

  return { user: userProfile as User, accessToken: clean };
};

/**
 * Sign In with Google via Popup to choose Google Drive account
 * Always presents Google's account picker so the user can choose which account to sync with.
 */
export const googleSignIn = async (): Promise<{
  user: User;
  accessToken: string;
} | null> => {
  try {
    isSigningIn = true;

    // 1. Google Identity Services (GIS) tokenClient provides direct Google Account Picker ("Escolha uma conta")
    try {
      const gsiRes = await googleSignInViaGsi();
      if (gsiRes?.accessToken) {
        cachedAccessToken = gsiRes.accessToken;
        setCachedAccessToken(cachedAccessToken, Date.now() + 3500 * 1000);
        return gsiRes;
      } else if (gsiRes === null) {
        // User closed or cancelled account picker
        return null;
      }
    } catch (gsiErr: any) {
      console.info('[Google Drive] Tentando popup alternativo após GIS:', gsiErr?.message);
    }

    // 2. Fallback to Firebase Auth popup with prompt: 'select_account'
    provider.setCustomParameters({
      prompt: 'select_account',
    });
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Não foi possível obter o token de acesso do Google Drive.');
    }

    cachedAccessToken = credential.accessToken;
    setCachedAccessToken(cachedAccessToken, Date.now() + 3500 * 1000);
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    // If the user closed the popup or it was cancelled, handle gracefully without alarming error
    if (
      error?.code === 'auth/popup-closed-by-user' ||
      error?.code === 'auth/cancelled-popup-request' ||
      error?.message?.includes('popup-closed-by-user')
    ) {
      console.warn('Conexão Google Drive cancelada pelo usuário (janela fechada).');
      return null;
    }

    // If Firebase Auth throws unauthorized domain, try GIS once more if available
    if (
      error?.code === 'auth/unauthorized-domain' ||
      error?.message?.includes('unauthorized-domain')
    ) {
      const domainName = typeof window !== 'undefined' ? window.location.hostname : 'este domínio';
      const customErr: any = new Error(
        `Domínio não autorizado no Firebase Authentication (${domainName}). Adicione este domínio nas configurações do Firebase ou vincule o token de acesso diretamente.`
      );
      customErr.code = 'auth/unauthorized-domain';
      customErr.unauthorizedDomain = domainName;
      customErr.projectId = firebaseAuthConfig.projectId;
      throw customErr;
    }

    const friendlyMessage = getDriveAuthFriendlyMessage(error);
    console.warn('Erro ao conectar Google Drive:', friendlyMessage);
    const customErr = new Error(friendlyMessage);
    (customErr as any).code = error?.code;
    throw customErr;
  } finally {
    isSigningIn = false;
  }
};

/**
 * Get current in-memory access token
 */
export const getAccessToken = async (): Promise<string | null> => {
  return getCachedToken();
};

export const getCachedToken = (): string | null => {
  if (isTokenExpired()) {
    cachedAccessToken = null;
    cachedTokenExpiry = null;
    return null;
  }
  return cachedAccessToken;
};

export const hasActiveSession = (): boolean => {
  return true;
};

export const requestGoogleLogin = googleSignIn;

/**
 * Disconnect Google Drive session
 */
export const logoutGoogle = async () => {
  await signOut(auth).catch(() => {});
  cachedAccessToken = null;
  cachedTokenExpiry = null;
  try {
    localStorage.removeItem(STORAGE_TOKEN_KEY);
    localStorage.removeItem(STORAGE_EXPIRY_KEY);
  } catch {}
};

// =========================================================================
// GOOGLE DRIVE API v3 HELPER FUNCTIONS
// =========================================================================

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3/files';

/**
 * Search for an existing folder or file by name and parent
 */
export const findDriveFolder = async (
  accessToken: string,
  folderName: string,
  parentId?: string
): Promise<DriveFolderResult | null> => {
  let query = `mimeType='application/vnd.google-apps.folder' and name='${folderName.replace(/'/g, "\\'")}' and trashed=false`;
  if (parentId) {
    query += ` and '${parentId}' in parents`;
  }

  const url = `${DRIVE_API_BASE}?q=${encodeURIComponent(query)}&fields=files(id,name,webViewLink)&pageSize=1`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    if (res.status === 401) {
      cachedAccessToken = null;
      cachedTokenExpiry = null;
    }
    const errorData = await res.json().catch(() => ({}));
    const err = new Error(
      res.status === 401
        ? 'Sessão do Google Drive expirada. Autorize novamente para continuar.'
        : errorData.error?.message || `Erro ao buscar pasta no Google Drive (${res.status})`
    );
    (err as any).status = res.status;
    (err as any).code = res.status === 401 ? 'TOKEN_EXPIRED' : undefined;
    throw err;
  }

  const data = await res.json();
  if (data.files && data.files.length > 0) {
    return {
      id: data.files[0].id,
      name: data.files[0].name,
      webViewLink: data.files[0].webViewLink,
    };
  }
  return null;
};

/**
 * Create a new folder on Google Drive
 */
export const createDriveFolder = async (
  accessToken: string,
  folderName: string,
  parentId?: string
): Promise<DriveFolderResult> => {
  const metadata: { name: string; mimeType: string; parents?: string[] } = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
  };

  if (parentId) {
    metadata.parents = [parentId];
  }

  const res = await fetch(`${DRIVE_API_BASE}?fields=id,name,webViewLink`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(metadata),
  });

  if (!res.ok) {
    if (res.status === 401) {
      cachedAccessToken = null;
      cachedTokenExpiry = null;
    }
    const errorData = await res.json().catch(() => ({}));
    const err = new Error(
      res.status === 401
        ? 'Sessão do Google Drive expirada. Autorize novamente para continuar.'
        : errorData.error?.message || `Erro ao criar pasta no Google Drive (${res.status})`
    );
    (err as any).status = res.status;
    (err as any).code = res.status === 401 ? 'TOKEN_EXPIRED' : undefined;
    throw err;
  }

  const data = await res.json();
  return {
    id: data.id,
    name: data.name,
    webViewLink: data.webViewLink,
  };
};

/**
 * Get or Create a folder (avoids duplicates)
 */
export const getOrCreateDriveFolder = async (
  accessToken: string,
  folderName: string,
  parentId?: string
): Promise<DriveFolderResult> => {
  const existing = await findDriveFolder(accessToken, folderName, parentId);
  if (existing) {
    return existing;
  }
  return await createDriveFolder(accessToken, folderName, parentId);
};

/**
 * Automatically builds and ensures the folder hierarchy for a Client (Empresa):
 * 1. Root: [MÍDIA INDOOR - ARQUIVOS DO SISTEMA]
 * 2. Pasta do Cliente: {clientName}
 * 3. Subpastas separadoras por categoria:
 *    - 📸 Fotos com Código Único
 *    - 📄 Documentos e Arquivos
 */
export const ensureClientFolders = async (
  accessToken: string,
  clientName: string,
  customRootName: string = 'MÍDIA INDOOR - ARQUIVOS DO SISTEMA'
): Promise<ClientHierarchyStructure> => {
  // 1. Root folder
  const rootFolder = await getOrCreateDriveFolder(accessToken, customRootName);

  // 2. Pasta direta do Cliente (Empresa)
  const cleanName = (clientName || 'Cliente').trim();
  const clientFolder = await getOrCreateDriveFolder(
    accessToken,
    cleanName,
    rootFolder.id
  );

  // 3. Pastas separadoras por categoria dentro da pasta do cliente (executadas sequencialmente)
  const photosFolder = await getOrCreateDriveFolder(
    accessToken,
    '📸 Fotos com Código Único',
    clientFolder.id
  );
  const documentsFolder = await getOrCreateDriveFolder(
    accessToken,
    '📄 Documentos e Arquivos',
    clientFolder.id
  );

  return {
    rootFolder,
    clientFolder,
    categoryFolders: {
      photos: photosFolder,
      documents: documentsFolder,
    },
  };
};

export const ensureClientHierarchy = async (
  accessToken: string,
  companyName: string,
  _ignoredSubClientName?: string,
  customRootName?: string
): Promise<ClientHierarchyStructure> => {
  return ensureClientFolders(accessToken, companyName, customRootName);
};

/**
 * Upload a file directly to Google Drive into a designated folder with custom metadata
 */
export const uploadFileToDrive = async (
  accessToken: string,
  file: File | Blob,
  fileName: string,
  folderId: string,
  options?:
    | {
        description?: string;
        uniqueCode?: string;
      }
    | string
): Promise<DriveUploadResult> => {
  const desc =
    typeof options === 'string'
      ? options
      : options?.description || `Código Único: ${options?.uniqueCode || 'N/A'}`;

  const metadata = {
    name: fileName,
    parents: [folderId],
    description: desc,
  };

  const formData = new FormData();
  formData.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' })
  );
  formData.append('file', file);

  const url = `${DRIVE_UPLOAD_BASE}?uploadType=multipart&fields=id,name,mimeType,webViewLink,webContentLink,size`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  });

  if (!res.ok) {
    if (res.status === 401) {
      cachedAccessToken = null;
      cachedTokenExpiry = null;
    }
    const errorData = await res.json().catch(() => ({}));
    const err = new Error(
      res.status === 401
        ? 'Sessão do Google Drive expirada. Autorize novamente para continuar.'
        : errorData.error?.message || `Erro ao enviar arquivo para o Google Drive (${res.status})`
    );
    (err as any).status = res.status;
    (err as any).code = res.status === 401 ? 'TOKEN_EXPIRED' : undefined;
    throw err;
  }

  const data = await res.json();

  // Set file as public reader so screens and TVs can display it directly
  await makeDriveFilePublic(accessToken, data.id).catch(() => {});

  const directStreamLink = getDriveDirectStreamUrl(data.id);

  return {
    id: data.id,
    name: data.name,
    mimeType: data.mimeType,
    webViewLink: data.webViewLink,
    webContentLink: data.webContentLink,
    directStreamLink,
    size: data.size ? Number(data.size) : undefined,
  };
};

/**
 * Returns direct streaming URL for Google Drive media files
 */
export const getDriveDirectStreamUrl = (fileId: string): string => {
  return `https://lh3.googleusercontent.com/d/${fileId}`;
};

/**
 * Extracts Google Drive file ID from any URL format
 */
export const extractDriveFileId = (url: string | undefined | null): string | null => {
  if (!url) return null;
  const trimmed = url.trim();
  const fileIdMatch =
    trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
    trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/) ||
    trimmed.match(/googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/) ||
    trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/) ||
    trimmed.match(/\/drive\/stream\/([a-zA-Z0-9_-]+)/);
  return fileIdMatch && fileIdMatch[1] ? fileIdMatch[1] : null;
};

/**
 * Resolves any Google Drive web or view link to a direct streaming/image CDN URL.
 * Supports file/d/ID, open?id=ID, uc?id=ID, and passes other URLs intact.
 */
export const resolveMediaDisplayUrl = (url: string | undefined | null): string => {
  if (!url) return '';
  const trimmed = url.trim();
  if (!trimmed || trimmed.startsWith('widget:') || trimmed.startsWith('data:')) {
    return trimmed;
  }

  const backendBase = import.meta.env.VITE_API_BASE_URL as string | undefined;
  const origin = backendBase && backendBase.startsWith('http') ? backendBase.replace(/\/api\/?$/, '') : '';

  // Local uploads and backend stream proxy URLs
  if (trimmed.startsWith('/uploads/') || trimmed.startsWith('/api/drive/stream/')) {
    return origin ? `${origin}${trimmed}` : trimmed;
  }

  // Convert lh3 Google Direct links or Google Drive links to stream proxy
  if (
    trimmed.includes('lh3.googleusercontent.com') ||
    trimmed.includes('drive.google.com') ||
    trimmed.includes('docs.google.com')
  ) {
    const fileId = extractDriveFileId(trimmed);
    if (fileId) {
      return origin ? `${origin}/api/drive/stream/${fileId}` : `/api/drive/stream/${fileId}`;
    }
  }

  // Check IndexedDB local media storage
  if (trimmed.startsWith('idb:')) {
    try {
      const cached = getCachedIndexedDbMediaSync(trimmed);
      if (cached) return cached;
      // Kick off background retrieval to warm the cache
      getIndexedDbMedia(trimmed);
    } catch {}
    return trimmed;
  }

  return trimmed;
};

/**
 * Makes a Google Drive file accessible with public view permissions
 */
export const makeDriveFilePublic = async (
  accessToken: string,
  fileId: string
): Promise<boolean> => {
  try {
    const url = `${DRIVE_API_BASE}/${fileId}/permissions`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        role: 'reader',
        type: 'anyone',
      }),
    });
    return res.ok;
  } catch (err) {
    console.warn('[Google Drive] Could not set public permission:', err);
    return false;
  }
};

/**
 * List files inside a specific Google Drive folder
 */
export const listDriveFolderFiles = async (
  accessToken: string,
  folderId: string
): Promise<any[]> => {
  const query = `'${folderId}' in parents and trashed=false`;
  const url = `${DRIVE_API_BASE}?q=${encodeURIComponent(
    query
  )}&fields=files(id,name,mimeType,webViewLink,webContentLink,thumbnailLink,size,createdTime,description)&pageSize=100`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    if (res.status === 401) {
      cachedAccessToken = null;
      cachedTokenExpiry = null;
    }
    const errorData = await res.json().catch(() => ({}));
    const err = new Error(
      res.status === 401
        ? 'Sessão do Google Drive expirada. Autorize novamente para continuar.'
        : errorData.error?.message || `Erro ao listar arquivos do Google Drive (${res.status})`
    );
    (err as any).status = res.status;
    (err as any).code = res.status === 401 ? 'TOKEN_EXPIRED' : undefined;
    throw err;
  }

  const data = await res.json();
  return data.files || [];
};

/**
 * Delete a file from Google Drive (Mandatory user confirmation handled by caller or dialog)
 */
export const deleteDriveFile = async (
  accessToken: string,
  fileId: string
): Promise<boolean> => {
  const url = `${DRIVE_API_BASE}/${fileId}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    if (res.status === 401) {
      cachedAccessToken = null;
      cachedTokenExpiry = null;
    }
    const errorData = await res.json().catch(() => ({}));
    const err = new Error(
      res.status === 401
        ? 'Sessão do Google Drive expirada. Autorize novamente para continuar.'
        : errorData.error?.message || `Erro ao excluir arquivo do Google Drive (${res.status})`
    );
    (err as any).status = res.status;
    (err as any).code = res.status === 401 ? 'TOKEN_EXPIRED' : undefined;
    throw err;
  }

  return true;
};



/**
 * Checks a specific file in Google Drive to verify if it is active, trashed or missing
 */
export const verifyDriveFileStatus = async (
  accessToken: string,
  fileId: string
): Promise<{
  accessible: boolean;
  status: 'ok' | 'trashed' | 'not_found' | 'permission_denied' | 'error';
  name?: string;
  size?: number;
  message: string;
}> => {
  try {
    const url = `${DRIVE_API_BASE}/${fileId}?fields=id,name,trashed,size,mimeType,shared`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (data.trashed) {
        return {
          accessible: false,
          status: 'trashed',
          name: data.name,
          message: 'Arquivo foi movido para a Lixeira do Google Drive.',
        };
      }
      return {
        accessible: true,
        status: 'ok',
        name: data.name,
        size: data.size ? Number(data.size) : undefined,
        message: 'Arquivo ativo e íntegro no Google Drive.',
      };
    }

    if (res.status === 404) {
      return {
        accessible: false,
        status: 'not_found',
        message: 'Arquivo não encontrado ou excluído do Google Drive.',
      };
    }

    if (res.status === 403) {
      return {
        accessible: false,
        status: 'permission_denied',
        message: 'Acesso negado: permissões insuficientes ou link revogado no Google Drive.',
      };
    }

    return {
      accessible: false,
      status: 'error',
      message: `Google Drive respondeu com status ${res.status}.`,
    };
  } catch (err: any) {
    return {
      accessible: false,
      status: 'error',
      message: err.message || 'Erro ao conectar com Google Drive.',
    };
  }
};

