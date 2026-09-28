import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  signInWithCredential,
  signOut, 
  onAuthStateChanged, 
  User,
  browserPopupRedirectResolver,
  deleteUser,
  reauthenticateWithPopup,
  reauthenticateWithCredential,
} from 'firebase/auth';
import { Platform, TurboModuleRegistry } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { auth } from '@/config/firebase';
import { googleDriveService } from '@/services/googleDriveService';
import { deleteAllUserCloudData } from '@/services/firestoreService';

// Complete auth session if returning from a web-browser auth flow
WebBrowser.maybeCompleteAuthSession();

// Configure Google Auth Provider with Profile and Email scopes for Web
const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('profile');
googleProvider.addScope('email');
googleProvider.setCustomParameters({ prompt: 'select_account' });

let GoogleSigninModule: any = null;
let googleSigninConfigured = false;

/**
 * Safely retrieves the native GoogleSignin TurboModule if available in the compiled binary.
 * If running in Expo Go or without native custom client, returns null without crashing the bundle.
 */
function getNativeGoogleSignin(): any | null {
  if (Platform.OS === 'web') return null;
  if (GoogleSigninModule) return GoogleSigninModule;

  // Preemptively check if the native TurboModule is actually registered in the binary.
  // In Expo Go or standard dev environments, this avoids TurboModuleRegistry.getEnforcing throwing an Invariant Violation.
  try {
    if (TurboModuleRegistry?.get && !TurboModuleRegistry.get('RNGoogleSignin')) {
      return null;
    }
  } catch {
    return null;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('@react-native-google-signin/google-signin');
    const GoogleSignin = mod?.GoogleSignin;
    if (GoogleSignin && !googleSigninConfigured) {
      GoogleSignin.configure({
        webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
        scopes: ['profile', 'email'],
      });
      googleSigninConfigured = true;
    }
    GoogleSigninModule = GoogleSignin;
    return GoogleSigninModule;
  } catch (err) {
    // Native TurboModule 'RNGoogleSignin' not registered in current binary
    return null;
  }
}

export interface AuthResult {
  success: boolean;
  user?: User;
  error?: string;
}

/**
 * Format Firebase Auth errors into clear, friendly messages
 */
function getFriendlyAuthErrorMessage(error: any): string {
  const code = error?.code || '';
  switch (code) {
    case 'auth/popup-closed-by-user':
      return 'Sign-in window was closed before completing.';
    case 'auth/popup-blocked':
      return 'Sign-in popup was blocked by browser. Please allow popups for this site.';
    case 'auth/cancelled-popup-request':
      return 'Only one sign-in request can be in progress at a time.';
    case 'auth/unauthorized-domain':
      return 'This domain is not authorized in Firebase Console (Authentication > Settings > Authorized Domains).';
    case 'auth/operation-not-allowed':
      return 'Google Sign-In is not enabled in Firebase Console. Please verify it is enabled under Authentication > Sign-in method.';
    case 'auth/network-request-failed':
      return 'Network connection failed. Please check your internet connection.';
    case 'auth/internal-error':
      return 'Firebase internal error. Please try again.';
    default:
      return error?.message || 'Failed to sign in with Google.';
  }
}

/**
 * Check if the user is returning from a redirect-based Google Sign In (Web)
 */
export async function checkRedirectAuth(): Promise<User | null> {
  if (Platform.OS === 'web') {
    try {
      const result = await getRedirectResult(auth, browserPopupRedirectResolver);
      if (result && result.user) {
        return result.user;
      }
    } catch (e: any) {
      console.warn('[AuthService] checkRedirectAuth error:', e);
    }
  }
  return null;
}

/**
 * Universal Google Sign In for Web and Mobile (Native Google Play Services SDK with AuthSession fallback)
 */
export async function signInWithGoogle(): Promise<AuthResult> {
  try {
    if (Platform.OS === 'web') {
      // --- Web: Firebase popup with redirect fallback ---
      try {
        const result = await signInWithPopup(auth, googleProvider, browserPopupRedirectResolver);
        return { success: true, user: result.user };
      } catch (popupErr: any) {
        if (
          popupErr?.code === 'auth/popup-blocked' ||
          popupErr?.code === 'auth/operation-not-supported-in-this-environment'
        ) {
          console.log('[AuthService] Popup failed, falling back to redirect...', popupErr?.code);
          await signInWithRedirect(auth, googleProvider, browserPopupRedirectResolver);
          return { success: true };
        }
        throw popupErr;
      }
    } else {
      // --- Mobile (Android & iOS): Native Google Play Services ---
      const NativeGoogleSignin = getNativeGoogleSignin();
      if (NativeGoogleSignin) {
        try {
          await NativeGoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
          const signInResponse = await NativeGoogleSignin.signIn();
          const idToken = signInResponse.data?.idToken ?? (signInResponse as any).idToken;

          if (idToken) {
            return await signInWithGoogleIdToken(idToken);
          }
        } catch (nativeErr) {
          console.warn('[AuthService] Native Google Sign-In fallback to WebBrowser:', nativeErr);
        }
      }

      // Mobile Browser Fallback
      const ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '';
      const redirectUri = AuthSession.makeRedirectUri({
        native: `com.googleusercontent.apps.${ANDROID_CLIENT_ID.split('.apps.')[0]}:/oauth2redirect/google`,
      });

      const nonce = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
      const scopeString = ['openid', 'profile', 'email'].join(' ');
      const authUrl =
        `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${encodeURIComponent(ANDROID_CLIENT_ID)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&response_type=${encodeURIComponent('id_token')}` +
        `&scope=${encodeURIComponent(scopeString)}` +
        `&nonce=${encodeURIComponent(nonce)}` +
        `&prompt=select_account`;

      const authResponse = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

      if (authResponse.type === 'success' && authResponse.url) {
        const hashIndex = authResponse.url.indexOf('#');
        const queryIndex = authResponse.url.indexOf('?');
        const fragment =
          hashIndex !== -1
            ? authResponse.url.substring(hashIndex + 1)
            : queryIndex !== -1
            ? authResponse.url.substring(queryIndex + 1)
            : '';
        const params = new URLSearchParams(fragment);
        const idToken = params.get('id_token');

        if (idToken) {
          return await signInWithGoogleIdToken(idToken);
        }
        console.warn('[AuthService] No id_token received in auth callback.');
      }
      return { success: false, error: 'Sign-in flow did not complete.' };
    }
  } catch (e: any) {
    console.error('[AuthService] signInWithGoogle error:', e);
    return { success: false, error: getFriendlyAuthErrorMessage(e) };
  }
}

/**
 * Sign in using an ID token (e.g. from Google Sign-In on Native)
 */
export async function signInWithGoogleIdToken(idToken: string): Promise<AuthResult> {
  try {
    const credential = GoogleAuthProvider.credential(idToken);
    const result = await signInWithCredential(auth, credential);
    return { success: true, user: result.user };
  } catch (error: any) {
    return { 
      success: false, 
      error: getFriendlyAuthErrorMessage(error) 
    };
  }
}

/**
 * Sign out current user
 */
export async function signOutUser(): Promise<{ success: boolean; error?: string }> {
  try {
    if (Platform.OS !== 'web') {
      try {
        const NativeGoogleSignin = getNativeGoogleSignin();
        if (NativeGoogleSignin) {
          await NativeGoogleSignin.signOut();
        }
      } catch (e) {
        console.warn('[AuthService] GoogleSignin.signOut warning:', e);
      }
    }
    await signOut(auth);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Listen for Firebase Auth state changes
 */
export function subscribeToAuth(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

/**
 * Get current user
 */
export function getCurrentUser(): User | null {
  return auth.currentUser;
}

/**
 * Prompts the user to re-authenticate with Google to refresh credentials.
 * Mandatory before sensitive operations like account deletion to prevent auth/requires-recent-login errors.
 */
export async function reauthenticateCurrentUser(): Promise<{ success: boolean; error?: string }> {
  try {
    const user = auth.currentUser;
    if (!user) {
      return { success: false, error: 'No authenticated user found.' };
    }

    if (Platform.OS === 'web') {
      await reauthenticateWithPopup(user, googleProvider, browserPopupRedirectResolver);
      return { success: true };
    } else {
      // Try native SDK first
      const NativeGoogleSignin = getNativeGoogleSignin();
      if (NativeGoogleSignin) {
        try {
          await NativeGoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
          const signInResponse = await NativeGoogleSignin.signIn();
          const idToken = signInResponse.data?.idToken ?? (signInResponse as any).idToken;
          if (idToken) {
            const credential = GoogleAuthProvider.credential(idToken);
            await reauthenticateWithCredential(user, credential);
            return { success: true };
          }
        } catch (nativeErr) {
          console.warn('[AuthService] Native reauth fallback to WebBrowser:', nativeErr);
        }
      }

      // Fallback via AuthSession / WebBrowser
      const ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '';
      const redirectUri = AuthSession.makeRedirectUri({
        native: `com.googleusercontent.apps.${ANDROID_CLIENT_ID.split('.apps.')[0]}:/oauth2redirect/google`,
      });

      const nonce = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
      const scopeString = ['openid', 'profile', 'email'].join(' ');
      const authUrl =
        `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${encodeURIComponent(ANDROID_CLIENT_ID)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&response_type=${encodeURIComponent('id_token')}` +
        `&scope=${encodeURIComponent(scopeString)}` +
        `&nonce=${encodeURIComponent(nonce)}` +
        `&prompt=select_account`;

      const authResponse = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

      if (authResponse.type === 'success' && authResponse.url) {
        const hashIndex = authResponse.url.indexOf('#');
        const queryIndex = authResponse.url.indexOf('?');
        const fragment =
          hashIndex !== -1
            ? authResponse.url.substring(hashIndex + 1)
            : queryIndex !== -1
            ? authResponse.url.substring(queryIndex + 1)
            : '';
        const params = new URLSearchParams(fragment);
        const idToken = params.get('id_token');

        if (idToken) {
          const credential = GoogleAuthProvider.credential(idToken);
          await reauthenticateWithCredential(user, credential);
          return { success: true };
        }
      }
      return { success: false, error: 'Google sign-in verification was cancelled.' };
    }
  } catch (error: any) {
    console.warn('[AuthService] reauthenticateCurrentUser warning:', error);
    return {
      success: false,
      error: getFriendlyAuthErrorMessage(error) || error?.message || 'Verification failed.',
    };
  }
}

/**
 * Permanently delete the user's account and cloud data:
 * 1. Re-authenticates with Google first to ensure fresh credentials (avoids auth/requires-recent-login failure)
 * 2. Purges Firestore shops/{userId} collections and document
 * 3. Purges Firebase Storage folder shops/{userId}/
 * 4. Revokes Google Drive OAuth token and disconnects Drive
 * 5. Deletes Firebase Auth user
 * Complies with Google Play Account Deletion policy.
 */
export async function deleteCurrentUserAccount(): Promise<{ success: boolean; error?: string }> {
  try {
    const user = auth.currentUser;
    if (!user) {
      return { success: false, error: 'No authenticated user found.' };
    }

    // 1. Re-authenticate first: If cancelled, abort immediately to protect user data
    const reauthResult = await reauthenticateCurrentUser();
    if (!reauthResult.success) {
      return {
        success: false,
        error: reauthResult.error || 'Google verification is required to confirm account deletion.',
      };
    }

    const confirmedUser = auth.currentUser;
    if (!confirmedUser) {
      return { success: false, error: 'User session expired during verification.' };
    }

    // 2. Delete all Firestore records and Firebase Storage files while still authenticated.
    // Abort before Auth/Drive completion if cloud purge fails so the user can retry.
    const cloudResult = await deleteAllUserCloudData(confirmedUser.uid);
    if (!cloudResult.success) {
      console.error('[AuthService] Cloud data deletion failed:', cloudResult.error);
      return {
        success: false,
        error:
          cloudResult.error ||
          'Failed to delete cloud data. Your account was not deleted — please try again.',
      };
    }

    // 3. Revoke Google Drive OAuth token and clear local Drive session
    try {
      await googleDriveService.disconnect(true);
    } catch (driveErr) {
      console.warn('[AuthService] Drive disconnect warning during account deletion:', driveErr);
    }

    // 4. Delete Firebase Auth user (guaranteed fresh credentials from step 1)
    await deleteUser(confirmedUser);

    return { success: true };
  } catch (error: any) {
    console.error('[AuthService] deleteCurrentUserAccount error:', error);
    return {
      success: false,
      error: getFriendlyAuthErrorMessage(error) || error?.message || 'Failed to delete account.',
    };
  }
}
