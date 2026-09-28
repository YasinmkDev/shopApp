import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useShop } from '@/context/ShopContext';
import { Colors, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { LEGAL_CONFIG, openLegalUrl } from '@/constants/legal';


interface LoginScreenProps {
  onContinueAsGuest: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onContinueAsGuest }) => {
  const {
    signInWithGoogle,
    authLoading,
    settings,
    language,
    setLanguage,
  } = useShop();

  const theme = settings.darkMode ? Colors.dark : Colors.light;

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isUrdu = language === 'ur';

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const result = await signInWithGoogle();
      if (!result.success) {
        setErrorMessage(result.error || 'Failed to sign in with Google');
      }
    } catch (e: any) {
      setErrorMessage(e?.message || 'An unexpected error occurred during Google sign-in.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={[styles.rootContainer, { backgroundColor: theme.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {/* Top Bar: Language Toggle */}
          <View style={styles.topBar}>
            <View style={[styles.statusBadge, { backgroundColor: '#DCFCE7' }]}>
              <View style={styles.onlineDot} />
              <Text style={styles.statusBadgeText}>
                {isUrdu ? 'کلاؤڈ ریڈی' : 'Cloud Ready'}
              </Text>
            </View>

            {/* Language Pill Switcher */}
            <View style={[styles.langSwitchWrap, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
              <Pressable
                onPress={() => setLanguage('en')}
                style={[
                  styles.langOption,
                  !isUrdu && [styles.langOptionActive, { backgroundColor: theme.primary }],
                ]}
              >
                <Text
                  style={[
                    styles.langText,
                    { color: !isUrdu ? '#FFFFFF' : theme.textMuted },
                    !isUrdu && styles.langTextBold,
                  ]}
                >
                  EN
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setLanguage('ur')}
                style={[
                  styles.langOption,
                  isUrdu && [styles.langOptionActive, { backgroundColor: theme.primary }],
                ]}
              >
                <Text
                  style={[
                    styles.langText,
                    { color: isUrdu ? '#FFFFFF' : theme.textMuted },
                    isUrdu && styles.langTextBold,
                  ]}
                >
                  اردو
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Hero Branding Header */}
          <View style={styles.brandSection}>
            <View style={[styles.logoOuter, { backgroundColor: theme.primaryLight }]}>
              <View style={[styles.logoInner, { backgroundColor: theme.primary }]}>
                <Ionicons name="storefront" size={26} color="#FFFFFF" />
              </View>
            </View>

            <Text style={[styles.appTitle, { color: theme.text }]}>
              {isUrdu ? 'دکاندار ایپ' : 'Shopkeeper POS'}
            </Text>

            <Text style={[styles.appSubtitle, { color: theme.textMuted }]}>
              {isUrdu
                ? 'تیز رفتار بلنگ، انوینٹری اور ادھار کھاتہ کا مکمل نظام'
                : 'Smart POS, Inventory & Khata with Google Cloud Backup'}
            </Text>
          </View>

          {/* Error Banner */}
          {errorMessage ? (
            <View style={[styles.banner, styles.errorBanner]}>
              <Ionicons name="alert-circle" size={16} color="#B91C1C" />
              <Text style={styles.errorBannerText}>{errorMessage}</Text>
            </View>
          ) : null}

          {/* Key Features Grid */}
          <View style={styles.featuresContainer}>
            <View style={[styles.featureCard, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
              <View style={[styles.featureIcon, { backgroundColor: '#E0F2FE' }]}>
                <Ionicons name="flash-outline" size={16} color="#0284C7" />
              </View>
              <View style={styles.featureTextWrap}>
                <Text style={[styles.featureTitle, { color: theme.text }]}>
                  {isUrdu ? 'فوری بلنگ اور رسیدیں' : 'Fast Billing & Receipts'}
                </Text>
                <Text style={[styles.featureDesc, { color: theme.textMuted }]}>
                  {isUrdu ? 'تھرمل رسیدیں پرنٹ اور واٹس ایپ کریں' : 'Instant thermal print & WhatsApp receipts'}
                </Text>
              </View>
            </View>

            <View style={[styles.featureCard, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
              <View style={[styles.featureIcon, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="book-outline" size={16} color="#D97706" />
              </View>
              <View style={styles.featureTextWrap}>
                <Text style={[styles.featureTitle, { color: theme.text }]}>
                  {isUrdu ? 'گاہک ادھار کھاتہ' : 'Customer Udhaar Khata'}
                </Text>
                <Text style={[styles.featureDesc, { color: theme.textMuted }]}>
                  {isUrdu ? 'بقایا جات اور ادائیگیوں کا مکمل ریکارڈ' : 'Track customer dues, payments & reminders'}
                </Text>
              </View>
            </View>

            <View style={[styles.featureCard, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
              <View style={[styles.featureIcon, { backgroundColor: '#DCFCE7' }]}>
                <Ionicons name="cloud-done-outline" size={16} color="#15803D" />
              </View>
              <View style={styles.featureTextWrap}>
                <Text style={[styles.featureTitle, { color: theme.text }]}>
                  {isUrdu ? 'گوگل کلاؤڈ بیک اپ' : 'Firebase Cloud Sync'}
                </Text>
                <Text style={[styles.featureDesc, { color: theme.textMuted }]}>
                  {isUrdu ? 'موبائل گم یا تبدیل ہونے پر ڈیٹا محفوظ' : 'Real-time backup, access on phone or PC'}
                </Text>
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionSection}>
            {/* Primary Action: Google Sign In */}
            <Pressable
              onPress={handleGoogleSignIn}
              disabled={isLoading || authLoading}
              style={({ pressed }) => [
                styles.googleBtn,
                (pressed || isLoading) && { opacity: 0.88, transform: [{ scale: 0.98 }] },
              ]}
            >
              {isLoading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={styles.googleBtnText} numberOfLines={1}>
                    {isUrdu ? 'گوگل سے تصدیق ہو رہی ہے...' : 'Signing in with Google...'}
                  </Text>
                </View>
              ) : (
                <View style={styles.googleBtnInner}>
                  <View style={styles.googleIconCircle}>
                    <Ionicons name="logo-google" size={14} color="#EA4335" />
                  </View>
                  <Text style={styles.googleBtnText} numberOfLines={1} ellipsizeMode="tail">
                    {isUrdu ? 'گوگل اکاؤنٹ سے لاگ ان کریں' : 'Continue with Google'}
                  </Text>
                </View>
              )}
            </Pressable>

            {/* Divider */}
            <View style={styles.dividerRow}>
              <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
              <Text style={[styles.dividerText, { color: theme.textMuted }]}>
                {isUrdu ? 'یا' : 'OR'}
              </Text>
              <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
            </View>

            {/* Secondary Action: Explore as Guest */}
            <Pressable
              onPress={onContinueAsGuest}
              style={({ pressed }) => [
                styles.guestBtn,
                { borderColor: theme.border, backgroundColor: theme.surfaceSubtle },
                pressed && { opacity: 0.75, backgroundColor: theme.border },
              ]}
            >
              <Ionicons name="enter-outline" size={16} color={theme.text} />
              <Text style={[styles.guestBtnText, { color: theme.text }]} numberOfLines={1} ellipsizeMode="tail">
                {isUrdu ? 'آف لائن دکان شروع کریں (گیسٹ موڈ)' : 'Continue as Guest (Offline Mode)'}
              </Text>
              <Ionicons name="chevron-forward" size={14} color={theme.textMuted} />
            </Pressable>
          </View>

          {/* Footer Security Note & Privacy Policy */}
          <View style={styles.footerWrap}>
            <Ionicons name="lock-closed" size={13} color="#64748B" />
            <Text style={[styles.footerText, { color: theme.textMuted }]}>
              {isUrdu
                ? 'آپ کا ریکارڈ محفوظ اور انکرپٹڈ ہے • گوگل فائر بیس کلاؤڈ'
                : 'Encrypted & secured by Firebase Authentication'}
            </Text>
          </View>

          <View style={styles.legalLinksRow}>
            <Pressable onPress={() => openLegalUrl(LEGAL_CONFIG.privacyPolicyUrl)}>
              <Text style={[styles.legalLinkText, { color: theme.primary }]}>
                {isUrdu ? 'پرائیویسی پالیسی' : 'Privacy Policy'}
              </Text>
            </Pressable>
            <Text style={[styles.legalDot, { color: theme.textMuted }]}>•</Text>
            <Pressable onPress={() => openLegalUrl(LEGAL_CONFIG.termsOfServiceUrl)}>
              <Text style={[styles.legalLinkText, { color: theme.primary }]}>
                {isUrdu ? 'شرائط و ضوابط' : 'Terms of Service'}
              </Text>
            </Pressable>
          </View>

        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    width: '100%',
    overflow: 'hidden',
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    width: '100%',
  },
  card: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 18,
    ...Shadows.md,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: '#16A34A',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },
  langSwitchWrap: {
    flexDirection: 'row',
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    padding: 2,
  },
  langOption: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  langOptionActive: {
    ...Shadows.sm,
  },
  langText: {
    fontSize: 11,
    fontWeight: '600',
  },
  langTextBold: {
    fontWeight: '800',
  },
  brandSection: {
    alignItems: 'center',
    marginBottom: 14,
  },
  logoOuter: {
    width: 58,
    height: 58,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  logoInner: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  appTitle: {
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  appSubtitle: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
    lineHeight: 17,
    paddingHorizontal: 4,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: 10,
    borderRadius: BorderRadius.md,
    marginBottom: 10,
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
  featuresContainer: {
    gap: 6,
    marginBottom: 14,
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 9,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  featureIcon: {
    width: 30,
    height: 30,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTextWrap: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  featureDesc: {
    fontSize: 11,
    marginTop: 1,
    lineHeight: 14,
  },
  actionSection: {
    gap: 8,
  },
  googleBtn: {
    backgroundColor: '#0F172A',
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
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  googleIconCircle: {
    width: 22,
    height: 22,
    borderRadius: BorderRadius.full,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginVertical: 2,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  guestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: 6,
  },
  guestBtnText: {
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'center',
  },
  footerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: 12,
  },
  footerText: {
    fontSize: 10,
    textAlign: 'center',
  },
  legalLinksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  legalLinkText: {
    fontSize: 11,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  legalDot: {
    fontSize: 11,
  },
});
