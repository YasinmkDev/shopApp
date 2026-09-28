import * as WebBrowser from 'expo-web-browser';
import { Linking, Platform } from 'react-native';

export const LEGAL_CONFIG = {
  appName: 'Shopkeeper POS (دکاندار ایپ)',
  packageName: 'com.shahabkhan34.ShopkeeperApp',
  developerContact: 'techflow0500@gmail.com',
  privacyPolicyUrl: 'https://shopkeeper-ea7d8.web.app/privacy-policy.html',
  termsOfServiceUrl: 'https://shopkeeper-ea7d8.web.app/terms.html',
  accountDeletionUrl: 'https://shopkeeper-ea7d8.web.app/delete-account.html',
  appVersion: '1.0.0',
};

/**
 * Open external URL safely in in-app browser or default device browser
 */
export async function openLegalUrl(url: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    } else {
      await WebBrowser.openBrowserAsync(url, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
      });
    }
  } catch {
    Linking.openURL(url).catch((err) => {
      console.warn('[Legal] Could not open URL:', url, err);
    });
  }
}
