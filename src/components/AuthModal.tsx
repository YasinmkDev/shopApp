import React, { useState } from 'react';
import {
  Modal,
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
import { useShop } from '@/context/ShopContext';
import { Colors, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { LEGAL_CONFIG, openLegalUrl } from '@/constants/legal';


interface AuthModalProps {
  visible: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ visible, onClose }) => {
  const {
    user,
    authLoading,
    signInWithGoogle,
    logout,
    syncNow,
    settings,
    products,
    sales,
    khata,
  } = useShop();

  const theme = settings.darkMode ? Colors.dark : Colors.light;

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSignIn = async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      const result = await signInWithGoogle();
      if (!result.success) {
        setErrorMessage(result.error || 'Failed to sign in with Google');
      } else {
        setSuccessMessage('Successfully connected to Google Cloud!');
        setTimeout(() => {
          setSuccessMessage(null);
        }, 3500);
      }
    } catch (e: any) {
      setErrorMessage(e?.message || 'An unexpected error occurred during Google sign-in.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSyncNow = async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const res = await syncNow();
      if (res && !res.success) {
        setErrorMessage(res.error || 'Sync failed.');
      } else {
        setSuccessMessage('All store records synced with Firebase Cloud!');
        setTimeout(() => setSuccessMessage(null), 3500);
      }
    } catch (e: any) {
      setErrorMessage(e?.message || 'Sync failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = () => {
    const doLogout = async () => {
      try {
        setIsLoading(true);
        await logout();
        setSuccessMessage(null);
        setErrorMessage(null);
        onClose();
      } finally {
        setIsLoading(false);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to sign out? Your local records will remain safe.')) {
        doLogout();
      }
    } else {
      Alert.alert(
        'Sign Out',
        'Are you sure you want to sign out? Your local records will remain safe on this device.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign Out', style: 'destructive', onPress: doLogout },
        ]
      );
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <Pressable style={styles.backdropPress} onPress={onClose} />

        <View style={[styles.modalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {/* Header */}
          <View style={[styles.headerRow, { borderBottomColor: theme.border }]}>
            <View style={styles.headerTitleWrap}>
              <View style={[styles.cloudBadge, { backgroundColor: user ? '#DCFCE7' : theme.primaryLight }]}>
                <Ionicons
                  name={user ? 'cloud-done' : 'cloud-upload'}
                  size={20}
                  color={user ? '#15803D' : theme.primary}
                />
              </View>
              <View>
                <Text style={[styles.headerTitle, { color: theme.text }]}>
                  {user ? 'Google Cloud Backup' : 'Sign in with Google'}
                </Text>
                <Text style={[styles.headerSub, { color: theme.textMuted }]}>
                  {user ? 'Cloud Database Connected' : 'Safeguard your shopkeeper records'}
                </Text>
              </View>
            </View>

            <Pressable
              onPress={onClose}
              hitSlop={8}
              style={({ pressed }) => [
                styles.closeButton,
                { backgroundColor: theme.surfaceSubtle },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Ionicons name="close" size={18} color={theme.textMuted} />
            </Pressable>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
            {/* Feedback Banners */}
            {errorMessage ? (
              <View style={[styles.banner, styles.errorBanner]}>
                <Ionicons name="alert-circle" size={18} color="#B91C1C" />
                <Text style={styles.errorBannerText}>{errorMessage}</Text>
              </View>
            ) : null}

            {successMessage ? (
              <View style={[styles.banner, styles.successBanner]}>
                <Ionicons name="checkmark-circle" size={18} color="#15803D" />
                <Text style={styles.successBannerText}>{successMessage}</Text>
              </View>
            ) : null}

            {/* Content: Signed In vs Signed Out */}
            {user ? (
              // ── SIGNED IN VIEW ──────────────────────────────────────
              <View style={styles.signedInContent}>
                {/* User Card */}
                <View style={[styles.userCard, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
                  {user.photoURL ? (
                    <Image source={{ uri: user.photoURL }} style={styles.userAvatar} />
                  ) : (
                    <View style={[styles.userAvatarFallback, { backgroundColor: theme.primaryLight }]}>
                      <Text style={[styles.userAvatarText, { color: theme.primary }]}>
                        {(user.displayName || user.email || 'G')[0].toUpperCase()}
                      </Text>
                    </View>
                  )}

                  <View style={styles.userInfo}>
                    <Text style={[styles.userName, { color: theme.text }]} numberOfLines={1}>
                      {user.displayName || 'Google User'}
                    </Text>
                    <Text style={[styles.userEmail, { color: theme.textMuted }]} numberOfLines={1}>
                      {user.email}
                    </Text>
                    <View style={styles.activePill}>
                      <View style={styles.greenDot} />
                      <Text style={styles.activePillText}>Sync Active</Text>
                    </View>
                  </View>
                </View>

                {/* Cloud Sync Stats */}
                <View style={[styles.statsRow, { borderColor: theme.border }]}>
                  <View style={styles.statBox}>
                    <Text style={[styles.statNumber, { color: theme.primary }]}>{products.length}</Text>
                    <Text style={[styles.statLabel, { color: theme.textMuted }]}>Products</Text>
                  </View>
                  <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
                  <View style={styles.statBox}>
                    <Text style={[styles.statNumber, { color: '#059669' }]}>{sales.length}</Text>
                    <Text style={[styles.statLabel, { color: theme.textMuted }]}>Bills & Sales</Text>
                  </View>
                  <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
                  <View style={styles.statBox}>
                    <Text style={[styles.statNumber, { color: '#D97706' }]}>{khata.length}</Text>
                    <Text style={[styles.statLabel, { color: theme.textMuted }]}>Khata Ledgers</Text>
                  </View>
                </View>

                {/* Sync Action Buttons */}
                <Pressable
                  onPress={handleSyncNow}
                  disabled={isLoading}
                  style={({ pressed }) => [
                    styles.syncNowBtn,
                    { backgroundColor: theme.primary },
                    (pressed || isLoading) && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                  ]}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="refresh" size={18} color="#fff" />
                  )}
                  <Text style={styles.syncNowBtnText}>
                    {isLoading ? 'Syncing...' : 'Sync Store with Cloud Now'}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={handleSignOut}
                  disabled={isLoading}
                  style={({ pressed }) => [
                    styles.signOutBtn,
                    { borderColor: theme.border },
                    pressed && { backgroundColor: theme.dangerLight },
                  ]}
                >
                  <Ionicons name="log-out-outline" size={17} color={theme.danger} />
                  <Text style={[styles.signOutBtnText, { color: theme.danger }]}>Sign Out from Google</Text>
                </Pressable>
              </View>
            ) : (
              // ── SIGNED OUT VIEW ─────────────────────────────────────
              <View style={styles.signedOutContent}>
                {/* Benefits List */}
                <View style={styles.benefitsList}>
                  <View style={styles.benefitItem}>
                    <View style={[styles.benefitIcon, { backgroundColor: '#E0F2FE' }]}>
                      <Ionicons name="shield-checkmark" size={18} color="#0284C7" />
                    </View>
                    <View style={styles.benefitTextWrap}>
                      <Text style={[styles.benefitTitle, { color: theme.text }]}>Safe Cloud Backup</Text>
                      <Text style={[styles.benefitDesc, { color: theme.textMuted }]}>
                        Never lose store records if you lose your phone or switch devices.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.benefitItem}>
                    <View style={[styles.benefitIcon, { backgroundColor: '#DCFCE7' }]}>
                      <Ionicons name="sync" size={18} color="#15803D" />
                    </View>
                    <View style={styles.benefitTextWrap}>
                      <Text style={[styles.benefitTitle, { color: theme.text }]}>Automatic Cloud Sync</Text>
                      <Text style={[styles.benefitDesc, { color: theme.textMuted }]}>
                        Every sale, product addition, and Khata payment backs up in real-time.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.benefitItem}>
                    <View style={[styles.benefitIcon, { backgroundColor: '#FEF3C7' }]}>
                      <Ionicons name="phone-portrait-outline" size={18} color="#D97706" />
                    </View>
                    <View style={styles.benefitTextWrap}>
                      <Text style={[styles.benefitTitle, { color: theme.text }]}>Multi-Device Access</Text>
                      <Text style={[styles.benefitDesc, { color: theme.textMuted }]}>
                        Log in on your counter tablet, phone, or laptop browser with one account.
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Prominent Google Sign-In Button */}
                <Pressable
                  onPress={handleSignIn}
                  disabled={isLoading || authLoading}
                  style={({ pressed }) => [
                    styles.googleLoginBtn,
                    (pressed || isLoading) && { opacity: 0.88, transform: [{ scale: 0.98 }] },
                  ]}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <View style={styles.googleBtnInner}>
                      <View style={styles.googleIconBox}>
                        <Ionicons name="logo-google" size={20} color="#EA4335" />
                      </View>
                      <Text style={styles.googleLoginBtnText}>Continue with Google</Text>
                    </View>
                  )}
                </Pressable>

                <Text style={[styles.privacyNote, { color: theme.textMuted }]}>
                  🔒 Encrypted and secured via Firebase Authentication.
                </Text>

                <View style={styles.legalRow}>
                  <Text style={[styles.legalText, { color: theme.textMuted }]}>By continuing, you agree to our </Text>
                  <Pressable onPress={() => openLegalUrl(LEGAL_CONFIG.privacyPolicyUrl)}>
                    <Text style={[styles.legalLink, { color: theme.primary }]}>Privacy Policy</Text>
                  </Pressable>
                  <Text style={[styles.legalText, { color: theme.textMuted }]}> & </Text>
                  <Pressable onPress={() => openLegalUrl(LEGAL_CONFIG.termsOfServiceUrl)}>
                    <Text style={[styles.legalLink, { color: theme.primary }]}>Terms</Text>
                  </Pressable>
                </View>

              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  backdropPress: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    overflow: 'hidden',
    ...Shadows.md,
    maxHeight: '90%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  cloudBadge: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  headerSub: {
    fontSize: 11,
    marginTop: 1,
    fontWeight: '500',
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flexShrink: 1,
  },
  bodyContent: {
    padding: 14,
    gap: 12,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: 10,
    borderRadius: BorderRadius.md,
  },
  errorBanner: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
  },
  errorBannerText: {
    color: '#991B1B',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  successBanner: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
    borderWidth: 1,
  },
  successBannerText: {
    color: '#166534',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  // Signed out view
  signedOutContent: {
    gap: 14,
  },
  benefitsList: {
    gap: 8,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  benefitIcon: {
    width: 30,
    height: 30,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  benefitTextWrap: {
    flex: 1,
  },
  benefitTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  benefitDesc: {
    fontSize: 11,
    marginTop: 1,
    lineHeight: 15,
  },
  googleLoginBtn: {
    backgroundColor: '#1E293B',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  googleBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  googleIconBox: {
    width: 22,
    height: 22,
    borderRadius: BorderRadius.full,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleLoginBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  privacyNote: {
    fontSize: 10,
    textAlign: 'center',
    marginTop: -2,
  },
  legalRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -2,
  },
  legalText: {
    fontSize: 11,
  },
  legalLink: {
    fontSize: 11,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },

  // Signed in view
  signedInContent: {
    gap: Spacing.lg,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
  },
  userAvatarFallback: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: {
    fontSize: 20,
    fontWeight: '800',
  },
  userInfo: {
    flex: 1,
    gap: 2,
  },
  userName: {
    fontSize: 15,
    fontWeight: '800',
  },
  userEmail: {
    fontSize: 12,
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  greenDot: {
    width: 7,
    height: 7,
    borderRadius: BorderRadius.full,
    backgroundColor: '#22C55E',
  },
  activePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 24,
  },
  syncNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    ...Shadows.sm,
  },
  syncNowBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: 9,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  signOutBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
