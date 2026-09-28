import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Image,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { User } from 'firebase/auth';
import { useShop } from '@/context/ShopContext';
import { Colors, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { googleDriveService } from '@/services/googleDriveService';

interface ConnectDriveScreenProps {
  user: User;
  onGoNext: () => void;
}

export const ConnectDriveScreen: React.FC<ConnectDriveScreenProps> = ({ user, onGoNext }) => {
  const { settings, language } = useShop();
  const theme = settings.darkMode ? Colors.dark : Colors.light;
  const isUrdu = language === 'ur';

  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    // Check if Google Drive is already connected
    googleDriveService.getSavedAuth().then((auth) => {
      if (auth?.accessToken) {
        setIsConnected(true);
        setConnectedEmail(auth.email || null);
      }
    });
  }, []);

  const handleConnect = async () => {
    try {
      setIsConnecting(true);
      setErrorMessage(null);

      const res = await googleDriveService.connect();
      if (res.success && res.user) {
        setIsConnected(true);
        setConnectedEmail(res.user.email || null);
      } else {
        const err = res.error || 'Failed to connect Google Drive';
        if (err.includes('Google Drive API has not been used') || err.includes('disabled')) {
          const apiMsg =
            'Google Drive API needs to be enabled for your project.\n\nPlease visit: https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=65013515513';
          setErrorMessage(apiMsg);
          if (Platform.OS === 'web') {
            window.open(
              'https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=65013515513',
              '_blank'
            );
          }
        } else {
          setErrorMessage(err);
        }
      }
    } catch (e: any) {
      setErrorMessage(e?.message || 'Error connecting to Google Drive.');
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <View style={[styles.rootContainer, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          
          {/* Top User Info Badge */}
          <View style={[styles.userBadge, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
            {user.photoURL ? (
              <Image source={{ uri: user.photoURL }} style={styles.userAvatar} />
            ) : (
              <View style={[styles.userAvatarFallback, { backgroundColor: theme.primary }]}>
                <Ionicons name="person" size={18} color="#FFFFFF" />
              </View>
            )}
            <View style={styles.userInfoText}>
              <Text style={[styles.userName, { color: theme.text }]} numberOfLines={1}>
                {user.displayName || (isUrdu ? 'معزز دکاندار' : 'Shopkeeper')}
              </Text>
              <Text style={[styles.userEmail, { color: theme.textMuted }]} numberOfLines={1}>
                {user.email}
              </Text>
            </View>
            <View style={[styles.accountVerifiedPill, { backgroundColor: '#DCFCE7' }]}>
              <Ionicons name="checkmark-circle" size={14} color="#15803D" />
              <Text style={styles.accountVerifiedText}>
                {isUrdu ? 'لاگ ان مکمل' : 'Logged In'}
              </Text>
            </View>
          </View>

          {/* Drive Hero Icon */}
          <View style={styles.heroIconSection}>
            <View style={[styles.driveIconOuter, { backgroundColor: '#EFF6FF' }]}>
              <View style={[styles.driveIconInner, { backgroundColor: '#2563EB' }]}>
                <Ionicons name="logo-google" size={42} color="#FFFFFF" />
              </View>
              <View style={styles.cloudBadgeOver}>
                <Ionicons name="cloud-upload" size={18} color="#2563EB" />
              </View>
            </View>

            <Text style={[styles.title, { color: theme.text }]}>
              {isUrdu ? 'گوگل ڈرائیو منسلک کریں' : 'Connect Your Google Drive'}
            </Text>

            <Text style={[styles.subtitle, { color: theme.textMuted }]}>
              {isUrdu
                ? 'پروڈکٹس کی تصاویر اور رسیدیں محفوظ کریں — دکان کا ڈیٹا تبدیل ہونے پر ہم آہنگ'
                : 'Link your personal Google Drive to store product photos, invoice receipts, and syncs when store data changes.'}
            </Text>
          </View>

          {/* Error Message */}
          {errorMessage ? (
            <View style={[styles.banner, styles.errorBanner]}>
              <Ionicons name="alert-circle" size={18} color="#B91C1C" />
              <Text style={styles.errorBannerText}>{errorMessage}</Text>
            </View>
          ) : null}

          {/* Connection Status Box */}
          {isConnected ? (
            <View style={[styles.statusBox, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
              <View style={styles.statusBoxIcon}>
                <Ionicons name="checkmark-circle" size={32} color="#059669" />
              </View>
              <View style={styles.statusBoxTextWrap}>
                <Text style={styles.statusBoxTitle}>
                  {isUrdu ? 'گوگل ڈرائیو منسلک ہو گئی!' : 'Google Drive Connected!'}
                </Text>
                <Text style={styles.statusBoxDesc}>
                  {isUrdu
                    ? `منسلک اکاؤنٹ: ${connectedEmail || user.email || ''}۔ سامان کی تصاویر اور ڈیٹا بیک اپ ڈرائیو میں محفوظ ہوں گے۔`
                    : `Account: ${connectedEmail || user.email || 'Personal Google Account'}. Product photos and backups are ready.`}
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.featureList}>
              <View style={[styles.featureItem, { backgroundColor: theme.surfaceSubtle }]}>
                <View style={[styles.featureIconWrap, { backgroundColor: '#DBEAFE' }]}>
                  <Ionicons name="image-outline" size={20} color="#2563EB" />
                </View>
                <View style={styles.featureTextWrap}>
                  <Text style={[styles.featureItemTitle, { color: theme.text }]}>
                    {isUrdu ? 'کلاؤڈ فوٹو اسٹوریج' : 'Cloud Photo Storage'}
                  </Text>
                  <Text style={[styles.featureItemDesc, { color: theme.textMuted }]}>
                    {isUrdu
                      ? 'سامان کی تصاویر براہ راست آپ کی گوگل ڈرائیو میں محفوظ ہوں گی'
                      : 'High-resolution product photos uploaded straight to your Google Drive'}
                  </Text>
                </View>
              </View>

              <View style={[styles.featureItem, { backgroundColor: theme.surfaceSubtle }]}>
                <View style={[styles.featureIconWrap, { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name="shield-checkmark-outline" size={20} color="#D97706" />
                </View>
                <View style={styles.featureTextWrap}>
                  <Text style={[styles.featureItemTitle, { color: theme.text }]}>
                    {isUrdu ? 'کلاؤڈ اسٹور بیک اپ' : 'Secure Cloud Backup'}
                  </Text>
                  <Text style={[styles.featureItemDesc, { color: theme.textMuted }]}>
                    {isUrdu
                      ? 'سیلز، کھاتہ اور پروڈکٹس کا ڈیٹا کلاؤڈ میں محفوظ'
                      : 'Safeguard your sales, inventory, and Khata records in the cloud'}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionSection}>
            {!isConnected ? (
              <Pressable
                onPress={handleConnect}
                disabled={isConnecting}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  { backgroundColor: '#2563EB' },
                  (pressed || isConnecting) && { opacity: 0.88, transform: [{ scale: 0.98 }] },
                ]}
              >
                {isConnecting ? (
                  <View style={styles.btnRow}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text style={styles.btnText}>
                      {isUrdu ? 'گوگل ڈرائیو منسلک ہو رہی ہے...' : 'Connecting to Google Drive...'}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.btnRow}>
                    <Ionicons name="cloud-upload" size={20} color="#FFFFFF" />
                    <Text style={styles.btnText}>
                      {isUrdu ? 'گوگل ڈرائیو منسلک کریں' : 'Connect Your Google Drive'}
                    </Text>
                  </View>
                )}
              </Pressable>
            ) : (
              <Pressable
                onPress={onGoNext}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  { backgroundColor: '#059669' },
                  pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                ]}
              >
                <View style={styles.btnRow}>
                  <Text style={styles.btnText}>
                    {isUrdu ? 'اگلا مرحلہ (دکان میں داخل ہوں) ➔' : 'Go Next (Enter Store) ➔'}
                  </Text>
                  <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                </View>
              </Pressable>
            )}

            {/* Skip or Switch Account Option */}
            {isConnected ? (
              <Pressable
                onPress={handleConnect}
                style={({ pressed }) => [
                  styles.skipBtn,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={[styles.skipBtnText, { color: theme.textMuted }]}>
                  {isUrdu ? 'دوسرا اکاؤنٹ منسلک کریں' : 'Switch / Re-connect Google Account'}
                </Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={onGoNext}
                style={({ pressed }) => [
                  styles.skipBtn,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={[styles.skipBtnText, { color: theme.textMuted }]}>
                  {isUrdu ? 'ابھی چھوڑیں اور آگے بڑھیں ➔' : 'Skip for now & Go Next ➔'}
                </Text>
              </Pressable>
            )}
          </View>

        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    borderRadius: BorderRadius.xxl,
    borderWidth: 1,
    padding: Spacing.xl,
    ...Shadows.lg,
  },
  userBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
  },
  userAvatarFallback: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfoText: {
    flex: 1,
  },
  userName: {
    fontSize: 13,
    fontWeight: '700',
  },
  userEmail: {
    fontSize: 11,
  },
  accountVerifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  accountVerifiedText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803D',
  },
  heroIconSection: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  driveIconOuter: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    position: 'relative',
  },
  driveIconInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.md,
  },
  cloudBadgeOver: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: Spacing.sm,
  },
  featureList: {
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
  },
  featureIconWrap: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTextWrap: {
    flex: 1,
  },
  featureItemTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  featureItemDesc: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    borderWidth: 1.5,
    marginBottom: Spacing.lg,
  },
  statusBoxIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBoxTextWrap: {
    flex: 1,
  },
  statusBoxTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#065F46',
  },
  statusBoxDesc: {
    fontSize: 12,
    color: '#047857',
    marginTop: 2,
  },
  actionSection: {
    gap: Spacing.sm,
  },
  primaryBtn: {
    paddingVertical: 14,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.md,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  skipBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  skipBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  errorBanner: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  errorBannerText: {
    color: '#991B1B',
    fontSize: 12,
    flex: 1,
  },
});
