import { Platform, TurboModuleRegistry } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { GOOGLE_DRIVE_CONFIG } from '@/config/googleDrive';
import { ImageCacheService } from './imageCacheService';

WebBrowser.maybeCompleteAuthSession();

export interface GoogleDriveAuth {
  accessToken: string;
  email?: string;
  name?: string;
  picture?: string;
  expiresAt: number;
}

export interface DriveFolderCache {
  rootFolderId: string;
  imagesFolderId: string;
  backupsFolderId: string;
  billsFolderId: string;
}

const FOLDER_CACHE_KEY = '@shopkeeper_gdrive_folder_cache';

class GoogleDriveService {
  private currentAuth: GoogleDriveAuth | null = null;
  private folderCache: DriveFolderCache | null = null;

  /**
   * Loads saved credentials from AsyncStorage
   */
  async getSavedAuth(): Promise<GoogleDriveAuth | null> {
    if (this.currentAuth && this.currentAuth.expiresAt > Date.now() + 60000) {
      return this.currentAuth;
    }

    try {
      const raw = await AsyncStorage.getItem(GOOGLE_DRIVE_CONFIG.storageKey);
      if (!raw) return null;
      const parsed: GoogleDriveAuth = JSON.parse(raw);
      if (parsed.expiresAt > Date.now()) {
        this.currentAuth = parsed;
        return parsed;
      }
      // Expired token
      await this.disconnect();
      return null;
    } catch (e) {
      console.warn('[GoogleDriveService] Failed to load saved auth:', e);
      return null;
    }
  }

  /**
   * Save auth info to memory and storage
   */
  async saveAuth(auth: GoogleDriveAuth): Promise<void> {
    this.currentAuth = auth;
    await AsyncStorage.setItem(GOOGLE_DRIVE_CONFIG.storageKey, JSON.stringify(auth));
  }

  /**
   * Disconnect and clear local token cache.
   * If revokeToken is true, actively revokes the OAuth2 token with Google.
   */
  async disconnect(revokeToken: boolean = false): Promise<void> {
    try {
      const auth = this.currentAuth || (await this.getSavedAuth());
      if (revokeToken && auth?.accessToken) {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(auth.accessToken)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });
      }
    } catch (err) {
      console.warn('[GoogleDriveService] Token revocation notice (ignored):', err);
    }

    this.currentAuth = null;
    this.folderCache = null;
    await AsyncStorage.removeItem(GOOGLE_DRIVE_CONFIG.storageKey);
    await AsyncStorage.removeItem(FOLDER_CACHE_KEY);
  }

  /**
   * Connect with Google Drive OAuth2
   */
  async connect(): Promise<{ success: boolean; error?: string; user?: GoogleDriveAuth }> {
    try {
      const redirectUri = AuthSession.makeRedirectUri({
        scheme: 'shopkeeperapp',
        preferLocalhost: Platform.OS === 'web',
      });

      // Log exact redirect URI so you can register it in Google Cloud Console:
      // console.cloud.google.com -> OAuth 2.0 Client -> Authorized redirect URIs
      console.log('[GoogleDriveService] OAuth redirectUri:', redirectUri);

      const scopeString = GOOGLE_DRIVE_CONFIG.scopes.join(' ');
      const authUrl =
        `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${encodeURIComponent(GOOGLE_DRIVE_CONFIG.clientId)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&response_type=token` +
        `&scope=${encodeURIComponent(scopeString)}` +
        `&prompt=select_account`;

      if (Platform.OS === 'web') {
        try {
          const { signInWithPopup, GoogleAuthProvider } = await import('firebase/auth');
          const { auth } = await import('@/config/firebase');
          const googleProvider = new GoogleAuthProvider();
          googleProvider.addScope('https://www.googleapis.com/auth/drive.file');
          googleProvider.setCustomParameters({ prompt: 'select_account' });

          const fbResult = await signInWithPopup(auth, googleProvider);
          const credential = GoogleAuthProvider.credentialFromResult(fbResult);
          if (credential?.accessToken) {
            const driveUser: GoogleDriveAuth = {
              accessToken: credential.accessToken,
              email: fbResult.user.email || undefined,
              name: fbResult.user.displayName || undefined,
              picture: fbResult.user.photoURL || undefined,
              expiresAt: Date.now() + 3600 * 1000,
            };
            await this.saveAuth(driveUser);
            this.ensureFolders(driveUser.accessToken).catch((e) =>
              console.warn('[GoogleDriveService] Background folder ensure error:', e)
            );
            return { success: true, user: driveUser };
          }
        } catch (firebaseErr: any) {
          console.warn('[GoogleDriveService] Firebase Google sign-in fallback to popup:', firebaseErr);
        }

        const result = await this.openWebAuthPopup(authUrl, redirectUri);
        if (result && result.accessToken) {
          await this.saveAuth(result);
          // Initialize folders in background
          this.ensureFolders(result.accessToken).catch((e) =>
            console.warn('[GoogleDriveService] Background folder ensure error:', e)
          );
          return { success: true, user: result };
        }
        return { success: false, error: 'Google Drive authorization was cancelled or failed.' };
      } else {
        // --- Mobile (Android & iOS): Native Google Play Services SDK ---
        const hasNativeGoogleSignin =
          TurboModuleRegistry?.get ? TurboModuleRegistry.get('RNGoogleSignin') != null : false;

        if (hasNativeGoogleSignin) {
          try {
            const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
            await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

            try {
              await GoogleSignin.addScopes({
                scopes: GOOGLE_DRIVE_CONFIG.scopes,
              });
            } catch (scopeErr) {
              console.warn('[GoogleDriveService] addScopes fallback, attempting signIn:', scopeErr);
              await GoogleSignin.signIn();
            }

            const tokens = await GoogleSignin.getTokens();
            const currentUser = GoogleSignin.getCurrentUser();

            if (tokens.accessToken) {
              const driveUser: GoogleDriveAuth = {
                accessToken: tokens.accessToken,
                email: currentUser?.user?.email || undefined,
                name: currentUser?.user?.name || undefined,
                picture: currentUser?.user?.photo || undefined,
                expiresAt: Date.now() + 3500 * 1000,
              };
              await this.saveAuth(driveUser);
              this.ensureFolders(driveUser.accessToken).catch(console.warn);
              return { success: true, user: driveUser };
            }
          } catch (nativeErr: any) {
            console.warn('[GoogleDriveService] Native Google Sign-In fallback to WebBrowser:', nativeErr);
          }
        }

        // Browser Fallback (if native is unavailable)

        const authResponse = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
        if (authResponse.type === 'success' && authResponse.url) {
          const auth = this.extractTokenFromUrl(authResponse.url);
          if (auth) {
            await this.saveAuth(auth);
            this.ensureFolders(auth.accessToken).catch(console.warn);
            return { success: true, user: auth };
          }
        }
        return { success: false, error: 'Authorization flow did not complete.' };
      }
    } catch (e: any) {
      console.error('[GoogleDriveService] Connect error:', e);
      return { success: false, error: e?.message || 'Failed to connect Google Drive.' };
    }
  }

  /**
   * Open OAuth popup on Web
   */
  private async openWebAuthPopup(authUrl: string, redirectUri: string): Promise<GoogleDriveAuth | null> {
    return new Promise((resolve) => {
      const width = 500;
      const height = 650;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const popup = window.open(
        authUrl,
        'google_oauth_popup',
        `width=${width},height=${height},left=${left},top=${top},status=0,toolbar=0,menubar=0`
      );

      if (!popup) {
        // Fallback to direct redirect if popup blocked
        window.location.href = authUrl;
        return;
      }

      const checkInterval = setInterval(async () => {
        try {
          if (!popup || popup.closed) {
            clearInterval(checkInterval);
            resolve(null);
            return;
          }

          const currentUrl = popup.location?.href;
          if (currentUrl && currentUrl.startsWith(redirectUri)) {
            clearInterval(checkInterval);
            const auth = this.extractTokenFromUrl(currentUrl);
            popup.close();

            if (auth) {
              // Fetch user profile info
              try {
                const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                  headers: { Authorization: `Bearer ${auth.accessToken}` },
                });
                if (profileRes.ok) {
                  const profile = await profileRes.json();
                  auth.email = profile.email;
                  auth.name = profile.name;
                  auth.picture = profile.picture;
                }
              } catch (profileErr) {
                console.warn('[GoogleDriveService] Could not fetch profile:', profileErr);
              }
              resolve(auth);
            } else {
              resolve(null);
            }
          }
        } catch {
          // Cross-origin access error while popup is on google.com — normal until it redirects back
        }
      }, 500);
    });
  }

  /**
   * Extract access_token from hash parameters
   */
  private extractTokenFromUrl(url: string): GoogleDriveAuth | null {
    try {
      const hashIndex = url.indexOf('#');
      if (hashIndex === -1) return null;
      const hash = url.substring(hashIndex + 1);
      const params = new URLSearchParams(hash);

      const accessToken = params.get('access_token');
      const expiresIn = parseInt(params.get('expires_in') || '3600', 10);

      if (!accessToken) return null;

      return {
        accessToken,
        expiresAt: Date.now() + expiresIn * 1000,
      };
    } catch (e) {
      console.warn('[GoogleDriveService] Failed to extract token:', e);
      return null;
    }
  }

  /**
   * Returns root folder ID if initialized
   */
  async getRootFolderId(): Promise<string | null> {
    try {
      const auth = await this.getSavedAuth();
      if (!auth) return null;
      const folders = await this.ensureFolders(auth.accessToken);
      return folders.rootFolderId;
    } catch {
      return null;
    }
  }

  /**
   * Ensure root and subfolders exist in user's 5 TB Google Drive
   */
  async ensureFolders(token?: string): Promise<DriveFolderCache> {
    if (this.folderCache) return this.folderCache;

    try {
      const cached = await AsyncStorage.getItem(FOLDER_CACHE_KEY);
      if (cached) {
        this.folderCache = JSON.parse(cached);
        return this.folderCache!;
      }
    } catch {
      // Ignore
    }

    const accessToken = token || (await this.getSavedAuth())?.accessToken;
    if (!accessToken) throw new Error('Google Drive is not connected. Please connect Google Drive in Settings.');

    // 1. Locate or create root folder in user's Drive
    const rootId = await this.findOrCreateFolder(accessToken, GOOGLE_DRIVE_CONFIG.folderName);

    // 2. Locate or create Images, Backups, and Bills subfolders inside the root folder
    const imagesFolderId = await this.findOrCreateFolder(
      accessToken,
      GOOGLE_DRIVE_CONFIG.imagesFolderName,
      rootId
    );
    const backupsFolderId = await this.findOrCreateFolder(
      accessToken,
      GOOGLE_DRIVE_CONFIG.backupsFolderName,
      rootId
    );
    const billsFolderId = await this.findOrCreateFolder(
      accessToken,
      GOOGLE_DRIVE_CONFIG.billsFolderName,
      rootId
    );

    const cache: DriveFolderCache = {
      rootFolderId: rootId,
      imagesFolderId,
      backupsFolderId,
      billsFolderId,
    };

    this.folderCache = cache;
    await AsyncStorage.setItem(FOLDER_CACHE_KEY, JSON.stringify(cache));
    return cache;
  }

  /**
   * Uploads shop profile logo to Google Drive Images folder
   */
  async uploadProfileLogo(imageUri: string): Promise<string> {
    return this.uploadProductImage(imageUri, `shop_logo_${Date.now()}.jpg`);
  }

  /**
   * Uploads an individual sale / bill receipt directly to the Bills folder in Google Drive
   * Completely resilient: never throws or crashes the UI
   */
  async uploadBillToDrive(
    sale: any,
    shopSettings?: any
  ): Promise<{ id: string; name: string } | null> {
    try {
      const auth = await this.getSavedAuth();
      if (!auth) return null;

      const folders = await this.ensureFolders(auth.accessToken);
      const invNum = sale.invoiceNumber || sale.id.slice(0, 8);
      const dateStr = new Date(sale.date).toISOString().slice(0, 10);
      const filename = `bill_INV-${invNum}_${dateStr}.json`;

      const billSnapshot = {
        invoiceNumber: invNum,
        date: sale.date,
        customerName: sale.customerName || 'Walk-in Customer',
        customerPhone: sale.customerPhone || '',
        items: (sale.items || []).map((it: any) => ({
          name: it.name,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          total: it.total,
        })),
        subtotal:
          sale.subtotal ??
          (sale.items || []).reduce((acc: number, it: any) => acc + (it.total || 0), 0),
        discount: sale.discount || 0,
        grandTotal: sale.grandTotal ?? sale.total,
        paymentMethod: sale.paymentMethod || 'cash',
        shopName: shopSettings?.shopName || 'Shopkeeper POS',
        shopPhone: shopSettings?.phone || '',
        shopAddress: shopSettings?.address || '',
        syncedAt: new Date().toISOString(),
      };

      const billContent = JSON.stringify(billSnapshot, null, 2);

      const metadata = {
        name: filename,
        parents: [folders.billsFolderId],
        mimeType: 'application/json',
      };

      const boundary = '-------bill_boundary_' + Date.now();
      const multipartBody =
        `--${boundary}\r\n` +
        `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
        `${JSON.stringify(metadata)}\r\n` +
        `--${boundary}\r\n` +
        `Content-Type: application/json\r\n\r\n` +
        `${billContent}\r\n` +
        `--${boundary}--`;

      const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipartBody,
      });

      if (res.ok) {
        const data = await res.json();
        return { id: data.id, name: filename };
      }
      return null;
    } catch (err) {
      console.warn('[GoogleDriveService] Bill auto-upload skipped (silent):', err);
      return null;
    }
  }

  /**
   * Helper to find an existing folder or create one in the user's 5 TB Google Drive
   */
  private async findOrCreateFolder(accessToken: string, name: string, parentId?: string): Promise<string> {
    let q = `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    if (parentId) {
      q += ` and '${parentId}' in parents`;
    }

    const listRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (listRes.ok) {
      const data = await listRes.json();
      if (data.files && data.files.length > 0) {
        return data.files[0].id;
      }
    } else {
      const errData = await listRes.json().catch(() => ({}));
      const msg = errData?.error?.message;
      if (msg) throw new Error(msg);
    }

    // Create folder
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        mimeType: 'application/vnd.google-apps.folder',
        ...(parentId ? { parents: [parentId] } : {}),
      }),
    });

    if (!createRes.ok) {
      const createErr = await createRes.json().catch(() => ({}));
      const msg = createErr?.error?.message || `Failed to create Google Drive folder: ${name}`;
      throw new Error(msg);
    }

    const createData = await createRes.json();
    return createData.id;
  }

  /**
   * Uploads a product image directly to the 5 TB Google Drive
   * Returns a direct CDN thumbnail URL (https://lh3.googleusercontent.com/d/{fileId})
   */
  async uploadProductImage(imageUri: string, filename?: string): Promise<string> {
    const auth = await this.getSavedAuth();
    if (!auth) throw new Error('Google Drive is not connected. Please connect Google Drive in Settings.');

    const folders = await this.ensureFolders(auth.accessToken);
    const resolvedName = filename || `product_${Date.now()}.jpg`;

    // 1. Fetch image binary / blob
    let uriToFetch = imageUri;
    if (
      !uriToFetch.startsWith('http') &&
      !uriToFetch.startsWith('file://') &&
      !uriToFetch.startsWith('data:') &&
      !uriToFetch.startsWith('blob:') &&
      !uriToFetch.startsWith('content://')
    ) {
      uriToFetch = `data:image/jpeg;base64,${uriToFetch}`;
    }

    const response = await fetch(uriToFetch);
    const blob = await response.blob();
    const mimeType = blob.type || 'image/jpeg';

    // 2. Prepare multipart upload
    const metadata = {
      name: resolvedName,
      parents: [folders.imagesFolderId],
      mimeType,
    };

    const boundary = '-------dukandar_boundary_' + Date.now();
    const metadataHeader = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(
      metadata
    )}\r\n`;
    const fileHeader = `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`;
    const footer = `\r\n--${boundary}--`;

    const metadataBlob = new Blob([metadataHeader], { type: 'text/plain' });
    const fileHeaderBlob = new Blob([fileHeader], { type: 'text/plain' });
    const footerBlob = new Blob([footer], { type: 'text/plain' });

    const multipartBlob = new Blob([metadataBlob, fileHeaderBlob, blob, footerBlob], {
      type: `multipart/related; boundary=${boundary}`,
    });

    // 3. Upload to Google Drive
    const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartBlob,
    });

    if (!uploadRes.ok) {
      const err = await uploadRes.json();
      throw new Error(err?.error?.message || 'Failed to upload image to Google Drive.');
    }

    const fileData = await uploadRes.json();
    const fileId = fileData.id;

    // Cache the original image for instant offline and refresh display
    ImageCacheService.set(fileId, imageUri).catch(() => {});
    // 4. Return standard file reference (resolved privately via resolveDriveImageUrl with user auth)
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`;

  }

  /**
   * Uploads store backup JSON to Backups folder in Google Drive
   */
  async uploadStoreBackup(backupJsonString: string): Promise<{ id: string; name: string; size: number }> {
    const auth = await this.getSavedAuth();
    if (!auth) throw new Error('Google Drive is not connected.');

    const folders = await this.ensureFolders(auth.accessToken);
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const name = `dukandar_backup_${dateStr}.json`;

    const metadata = {
      name,
      parents: [folders.backupsFolderId],
      mimeType: 'application/json',
    };

    const boundary = '-------backup_boundary_' + Date.now();
    const multipartBody =
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: application/json\r\n\r\n` +
      `${backupJsonString}\r\n` +
      `--${boundary}--`;

    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err?.error?.message || 'Failed to upload backup to Google Drive.');
    }

    const data = await res.json();
    return {
      id: data.id,
      name,
      size: new Blob([backupJsonString]).size,
    };
  }

  /**
   * Check if Google Drive is currently connected
   */
  async isConnected(): Promise<boolean> {
    const auth = await this.getSavedAuth();
    return !!auth;
  }

  /**
   * Auto-syncs latest store state silently to Google Drive in the background.
   * Updates 'latest_store_backup.json' in Backups folder.
   * Completely resilient: never throws or disrupts the user.
   */
  async autoSyncBackupToDrive(backupJsonString: string): Promise<void> {
    try {
      const auth = await this.getSavedAuth();
      if (!auth) return;

      const folders = await this.ensureFolders(auth.accessToken);
      const filename = 'latest_store_backup.json';

      // Check if latest_store_backup.json already exists in Backups folder
      const q = `name='${filename}' and '${folders.backupsFolderId}' in parents and trashed=false`;
      const searchRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)`,
        { headers: { Authorization: `Bearer ${auth.accessToken}` } }
      );

      let existingFileId: string | null = null;
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (searchData.files && searchData.files.length > 0) {
          existingFileId = searchData.files[0].id;
        }
      }

      if (existingFileId) {
        // Overwrite existing latest backup file
        await fetch(
          `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=media`,
          {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${auth.accessToken}`,
              'Content-Type': 'application/json',
            },
            body: backupJsonString,
          }
        );
      } else {
        // Create it
        const metadata = {
          name: filename,
          parents: [folders.backupsFolderId],
          mimeType: 'application/json',
        };
        const boundary = '-------auto_backup_boundary_' + Date.now();
        const multipartBody =
          `--${boundary}\r\n` +
          `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
          `${JSON.stringify(metadata)}\r\n` +
          `--${boundary}\r\n` +
          `Content-Type: application/json\r\n\r\n` +
          `${backupJsonString}\r\n` +
          `--${boundary}--`;

        await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${auth.accessToken}`,
            'Content-Type': `multipart/related; boundary=${boundary}`,
          },
          body: multipartBody,
        });
      }
    } catch (e) {
      console.warn('[GoogleDriveService] Silent background auto-sync skipped:', e);
    }
  }
}

export const googleDriveService = new GoogleDriveService();

/**
 * Extracts Google Drive file ID from any drive URL format
 */
export function extractDriveFileId(uri?: string | null): string | null {
  if (!uri) return null;
  if (uri.startsWith('drive://')) {
    return uri.replace('drive://', '');
  }
  const matchD = uri.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (matchD) return matchD[1];

  const matchId = uri.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (matchId) return matchId[1];

  return null;
}

const activeResolutions = new Map<string, Promise<string>>();

/**
 * Resolves a Google Drive URL or local URI into a viewable image URI.
 * If the image is stored in Google Drive:
 * 1. Checks local cache (instant)
 * 2. Fetches via Google Drive API with OAuth Bearer Token (safe for private 5 TB files)
 * 3. Creates local object URL / data URL and caches it
 */
export async function resolveDriveImageUrl(uri?: string | null): Promise<string> {
  if (!uri) return '';

  // Local data URIs, blob URLs, or file URLs require no transformation
  if (uri.startsWith('data:') || uri.startsWith('blob:') || uri.startsWith('file://')) {
    return uri;
  }

  const fileId = extractDriveFileId(uri);
  if (!fileId) {
    return uri;
  }

  // 1. Check local cache first
  const cached = await ImageCacheService.get(fileId);
  if (cached) {
    return cached;
  }

  // 2. Check in-flight fetch to avoid duplicate concurrent requests
  if (activeResolutions.has(fileId)) {
    return activeResolutions.get(fileId)!;
  }

  const fetchPromise = (async () => {
    try {
      const auth = await googleDriveService.getSavedAuth();
      if (!auth?.accessToken) {
        // Not connected to drive: return fallback thumbnail URL
        return `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`;
      }

      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
        },
      });

      if (!res.ok) {
        console.warn(`[GoogleDriveService] Media fetch returned ${res.status} for file ${fileId}`);
        return `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`;
      }

      const blob = await res.blob();
      let resolvedUri: string;
      if (Platform.OS === 'web' && typeof URL !== 'undefined' && URL.createObjectURL) {
        resolvedUri = URL.createObjectURL(blob);
      } else {
        resolvedUri = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      }

      // Save to local cache so next time it loads instantly
      await ImageCacheService.set(fileId, resolvedUri);
      return resolvedUri;
    } catch (err) {
      console.warn('[GoogleDriveService] resolveDriveImageUrl error:', err);
      return uri;
    } finally {
      activeResolutions.delete(fileId);
    }
  })();

  activeResolutions.set(fileId, fetchPromise);
  return fetchPromise;
}
