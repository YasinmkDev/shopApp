import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Platform,
  Image,
  Switch,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useShop } from '@/context/ShopContext';
import { Colors, ThemeColors, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { CameraModal } from '@/components/CameraModal';
import { buildImportTemplateJSON } from '@/constants/sampleData';
import * as Linking from 'expo-linking';
import { googleDriveService, GoogleDriveAuth } from '@/services/googleDriveService';
import { LEGAL_CONFIG, openLegalUrl } from '@/constants/legal';


// ─── Types ────────────────────────────────────────────────────────────────────
type Segment = 'profile' | 'settings';

// ─── Sub-components ───────────────────────────────────────────────────────────

/** A simple labeled row with optional right-side content */
const RowItem: React.FC<{
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
  label: string;
  sublabel?: string;
  children?: React.ReactNode;
  onPress?: () => void;
  theme: ThemeColors;
  last?: boolean;
}> = ({ icon, iconColor, iconBg, label, sublabel, children, onPress, theme, last }) => (
  <Pressable
    onPress={onPress}
    disabled={!onPress}
    style={({ pressed }) => [
      styles.rowItem,
      !last && { borderBottomWidth: 1, borderBottomColor: theme.border },
      pressed && onPress && { backgroundColor: theme.surfaceSubtle },
    ]}
  >
    <View style={[styles.rowIcon, { backgroundColor: iconBg }]}>
      <Ionicons name={icon} size={18} color={iconColor} />
    </View>
    <View style={styles.rowLabelWrap}>
      <Text style={[styles.rowLabel, { color: theme.text }]}>{label}</Text>
      {sublabel ? <Text style={[styles.rowSub, { color: theme.textMuted }]}>{sublabel}</Text> : null}
    </View>
    {children ? (
      <View style={styles.rowRight}>{children}</View>
    ) : onPress ? (
      <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
    ) : null}
  </Pressable>
);

/** Inline editable field inside a RowItem */
const InlineField: React.FC<{
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'phone-pad' | 'email-address' | 'numeric';
  onSubmitEditing?: () => void;
  theme: ThemeColors;
}> = ({ value, onChangeText, placeholder, keyboardType = 'default', onSubmitEditing, theme }) => (
  <TextInput
    value={value}
    onChangeText={onChangeText}
    placeholder={placeholder}
    placeholderTextColor={theme.textMuted}
    keyboardType={keyboardType}
    onSubmitEditing={onSubmitEditing}
    style={[styles.inlineInput, { color: theme.text }]}
    textAlign="right"
  />
);

/** Section card wrapper */
const Section: React.FC<{ title: string; theme: ThemeColors; children: React.ReactNode }> = ({
  title,
  theme,
  children,
}) => (
  <View style={styles.sectionWrap}>
    <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>{title.toUpperCase()}</Text>
    <View style={[styles.sectionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      {children}
    </View>
  </View>
);

// ─── Main Screen ──────────────────────────────────────────────────────────────
export const SettingsScreen: React.FC = () => {
  const {
    settings,
    updateSettings,
    clearStoreData,
    exportDataJSON,
    importDataJSON,
    language,
    setLanguage,
    t,
    setActiveTab,
    products,
    todaySalesTotal,
    khata,
    user,
    authLoading,
    syncStatus,
    signInWithGoogle,
    logout,
    deleteAccount,
    syncNow,
    setIsAuthModalOpen,
  } = useShop();

  const theme = settings.darkMode ? Colors.dark : Colors.light;

  const [activeSegment, setActiveSegment] = useState<Segment>('profile');
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const [showImportBox, setShowImportBox] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);

  // Google Drive (5 TB)
  const [driveAuth, setDriveAuth] = useState<GoogleDriveAuth | null>(null);
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveBackupLoading, setDriveBackupLoading] = useState(false);
  const [driveBackupSuccess, setDriveBackupSuccess] = useState<string | null>(null);

  useEffect(() => {
    googleDriveService.getSavedAuth().then(setDriveAuth);
  }, []);

  // Profile fields (shop logo & store identity)
  const isGoogleAvatar = (url?: string | null) => !!url && url.includes('googleusercontent.com') && !url.includes('/d/');
  const cleanInitialPhoto = settings.profileImage && !isGoogleAvatar(settings.profileImage) ? settings.profileImage : '';
  const [profileImage, setProfileImage] = useState(cleanInitialPhoto);
  const [shopName, setShopName] = useState(settings.shopName);
  const [shopNameUrdu, setShopNameUrdu] = useState(settings.shopNameUrdu);
  const [ownerName, setOwnerName] = useState(settings.ownerName || user?.displayName || '');
  const [businessType, setBusinessType] = useState(settings.businessType || 'Kiryana & General Store');
  const [phone, setPhone] = useState(settings.phone);
  const [alternatePhone, setAlternatePhone] = useState(settings.alternatePhone || '');
  const [email, setEmail] = useState(settings.email || user?.email || '');
  const [address, setAddress] = useState(settings.address);
  const [city, setCity] = useState(settings.city || '');
  const [taxNumber, setTaxNumber] = useState(settings.taxNumber || '');
  const [paymentDetails, setPaymentDetails] = useState(settings.paymentDetails || '');
  const [businessHours, setBusinessHours] = useState(settings.businessHours || '');

  // Preferences fields
  const [currencySymbol, setCurrencySymbol] = useState(settings.currencySymbol);
  const [footerNote, setFooterNote] = useState(settings.footerNote);
  const [footerNoteUrdu, setFooterNoteUrdu] = useState(settings.footerNoteUrdu);
  const [lowStockThreshold, setLowStockThreshold] = useState(settings.lowStockThreshold.toString());

  // Synchronize form fields whenever settings or user updates (e.g. from Firebase sync)
  useEffect(() => {
    setProfileImage(settings.profileImage && !isGoogleAvatar(settings.profileImage) ? settings.profileImage : '');
    setShopName(settings.shopName);
    setShopNameUrdu(settings.shopNameUrdu);
    setOwnerName(settings.ownerName || user?.displayName || '');
    setBusinessType(settings.businessType || 'Kiryana & General Store');
    setPhone(settings.phone);
    setAlternatePhone(settings.alternatePhone || '');
    setEmail(settings.email || user?.email || '');
    setAddress(settings.address);
    setCity(settings.city || '');
    setTaxNumber(settings.taxNumber || '');
    setPaymentDetails(settings.paymentDetails || '');
    setBusinessHours(settings.businessHours || '');
    setCurrencySymbol(settings.currencySymbol);
    setFooterNote(settings.footerNote);
    setFooterNoteUrdu(settings.footerNoteUrdu);
    setLowStockThreshold(settings.lowStockThreshold.toString());
  }, [settings, user]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const pickImage = async () => {
    try {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(t('warningAlert'), 'Gallery permission required.');
          return;
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        handleLogoSelected(result.assets[0].uri);
      }
    } catch (e) {
      console.warn('Image picker error:', e);
    }
  };

  const handleLogoSelected = (localUri: string) => {
    setProfileImage(localUri);

    // Upload directly to 5 TB Google Drive if connected
    googleDriveService
      .getSavedAuth()
      .then((auth) => {
        if (auth) {
          googleDriveService
            .uploadProfileLogo(localUri)
            .then((driveUrl) => {
              setProfileImage(driveUrl);
              updateSettings({ profileImage: driveUrl }).catch(console.warn);
            })
            .catch((e) => console.warn('[SettingsScreen] Drive logo upload error:', e));
        }
      })
      .catch(() => {});
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateSettings({
        profileImage: profileImage.trim() || undefined,
        shopName: shopName.trim(),
        shopNameUrdu: shopNameUrdu.trim(),
        ownerName: ownerName.trim(),
        businessType: businessType.trim(),
        phone: phone.trim(),
        alternatePhone: alternatePhone.trim(),
        email: email.trim(),
        address: address.trim(),
        city: city.trim(),
        taxNumber: taxNumber.trim(),
        paymentDetails: paymentDetails.trim(),
        businessHours: businessHours.trim(),
        currencySymbol: currencySymbol.trim(),
        footerNote: footerNote.trim(),
        footerNoteUrdu: footerNoteUrdu.trim(),
        lowStockThreshold: parseInt(lowStockThreshold, 10) || 5,
      });
      if (Platform.OS === 'web') {
        window.alert(t('settingsSaved'));
      } else {
        Alert.alert(t('success'), t('settingsSaved'));
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = () => {
    const jsonStr = exportDataJSON();
    if (Platform.OS === 'web') {
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dukandar_backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      Alert.alert('Backup', 'Backup prepared successfully.');
    }
  };

  const handleImport = async () => {
    if (!importJsonText.trim()) return;
    const success = await importDataJSON(importJsonText);
    if (success) {
      if (Platform.OS === 'web') {
        window.alert('Data restored!');
      } else {
        Alert.alert(t('success'), 'Data restored!');
      }
      setImportJsonText('');
      setShowImportBox(false);
    } else {
      if (Platform.OS === 'web') {
        window.alert('Invalid backup JSON.');
      } else {
        Alert.alert(t('error'), 'Invalid backup JSON.');
      }
    }
  };

  const handleReset = () => {
    const confirmMsg = t('resetConfirm');
    if (Platform.OS === 'web') {
      if (window.confirm(confirmMsg)) {
        clearStoreData();
        window.alert(language === 'ur' ? 'ڈیٹا صاف ہو گیا!' : 'Store data cleared!');
      }
    } else {
      Alert.alert(t('warningAlert'), confirmMsg, [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('confirm'),
          style: 'destructive',
          onPress: async () => {
            await clearStoreData();
            Alert.alert(t('success'), language === 'ur' ? 'ڈیٹا صاف ہو گیا!' : 'Store data cleared!');
          },
        },
      ]);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setGoogleLoading(true);
      const res = await signInWithGoogle();
      if (!res.success) {
        if (Platform.OS === 'web') {
          window.alert(res.error || 'Failed to sign in with Google');
        } else {
          Alert.alert(t('error'), res.error || 'Failed to sign in with Google');
        }
      } else {
        const msg = 'Google account connected! Cloud sync is now active.';
        if (Platform.OS === 'web') {
          window.alert(msg);
        } else {
          Alert.alert(t('success'), msg);
        }
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleLogout = () => {
    const confirmAction = async () => {
      await logout();
      const msg = 'Signed out. Your local records are safe.';
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert(t('success'), msg);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Sign out from Google? Your local store data will remain safe.')) {
        confirmAction();
      }
    } else {
      Alert.alert(t('confirm'), 'Sign out from Google? Your local store data will remain safe.', [
        { text: t('cancel'), style: 'cancel' },
        { text: t('signOut'), style: 'destructive', onPress: confirmAction },
      ]);
    }
  };

  const handleDeleteAccount = () => {
    const confirmMsg = t('deleteAccountConfirm');

    const executeDeletion = async () => {
      try {
        setIsDeletingAccount(true);
        const res = await deleteAccount();
        if (!res.success) {
          const errMsg = res.error || 'Failed to delete account';
          if (Platform.OS === 'web') {
            window.alert(errMsg);
          } else {
            Alert.alert(t('error'), errMsg);
          }
        } else {
          const successMsg = t('deleteAccountSuccess');
          if (Platform.OS === 'web') {
            window.alert(successMsg);
          } else {
            Alert.alert(t('success'), successMsg);
          }
        }
      } catch (err: any) {
        const errMsg = err?.message || 'Failed to delete account';
        if (Platform.OS === 'web') {
          window.alert(errMsg);
        } else {
          Alert.alert(t('error'), errMsg);
        }
      } finally {
        setIsDeletingAccount(false);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(confirmMsg)) {
        executeDeletion();
      }
    } else {
      Alert.alert(
        t('warningAlert'),
        confirmMsg,
        [
          { text: t('cancel'), style: 'cancel' },
          {
            text: t('deleteAccount'),
            style: 'destructive',
            onPress: executeDeletion,
          },
        ]
      );
    }
  };


  const handleSyncNow = async () => {
    const res = await syncNow();
    const isSuccess = res ? res.success : true;
    const msg = isSuccess ? 'All store data synced to Firebase!' : `Sync encountered an error: ${res?.error || 'Failed'}`;
    if (Platform.OS === 'web') {
      window.alert(msg);
    } else {
      Alert.alert(isSuccess ? t('success') : t('error'), msg);
    }
  };

  const handleConnectDrive = async () => {
    setDriveLoading(true);
    try {
      const res = await googleDriveService.connect();
      if (res.success && res.user) {
        setDriveAuth(res.user);
        const msg = language === 'ur'
          ? 'گوگل ڈرائیو کامیابی سے منسلک ہو گئی!'
          : 'Google Drive connected successfully!';
        if (Platform.OS === 'web') {
          window.alert(msg);
        } else {
          Alert.alert(t('success'), msg);
        }
      } else {
        const err = res.error || 'Failed to connect Google Drive';
        if (Platform.OS === 'web') {
          window.alert(err);
        } else {
          Alert.alert(t('error'), err);
        }
      }
    } catch (e: any) {
      console.error('[SettingsScreen] Drive connect error:', e);
    } finally {
      setDriveLoading(false);
    }
  };

  const handleDisconnectDrive = async () => {
    const confirmMsg = language === 'ur'
      ? 'کیا آپ گوگل ڈرائیو منقطع کرنا چاہتے ہیں؟'
      : 'Disconnect Google Drive? Your existing files will remain safe.';
    const doDisconnect = async () => {
      await googleDriveService.disconnect();
      setDriveAuth(null);
    };

    if (Platform.OS === 'web') {
      if (window.confirm(confirmMsg)) {
        await doDisconnect();
      }
    } else {
      Alert.alert(t('confirm'), confirmMsg, [
        { text: t('no'), style: 'cancel' },
        { text: t('yes'), onPress: doDisconnect, style: 'destructive' },
      ]);
    }
  };

  const handleBackupToDrive = async () => {
    if (!driveAuth) {
      await handleConnectDrive();
      return;
    }
    setDriveBackupLoading(true);
    setDriveBackupSuccess(null);
    try {
      const jsonStr = exportDataJSON();
      const res = await googleDriveService.uploadStoreBackup(jsonStr);
      setDriveBackupSuccess(res.name);
      const msg = language === 'ur'
        ? `بیک اپ محفوظ ہو گیا: ${res.name}`
        : `Store backed up to Google Drive: ${res.name}`;
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert(t('success'), msg);
      }
    } catch (e: any) {
      console.error('[SettingsScreen] Drive backup error:', e);
      const err = e?.message || 'Failed to backup to Google Drive.';
      if (err.includes('Google Drive API has not been used') || err.includes('disabled')) {
        if (Platform.OS === 'web') {
          window.open(
            'https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=65013515513',
            '_blank'
          );
          window.alert(
            'We opened the Google Cloud Console in a new tab for you!\n\n' +
            '1. Click the blue "ENABLE" button on that page.\n' +
            '2. Wait 1 minute.\n' +
            '3. Come back and retry your backup.'
          );
        } else {
          Alert.alert(
            'Google Drive Setup Required',
            'Please visit:\nhttps://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=65013515513\n\nand click "ENABLE".'
          );
        }
      } else {
        if (Platform.OS === 'web') {
          window.alert(err);
        } else {
          Alert.alert(t('error'), err);
        }
      }
    } finally {
      setDriveBackupLoading(false);
    }
  };

  const handleOpenDriveFolder = async () => {
    try {
      const rootId = await googleDriveService.getRootFolderId();
      const folderUrl = rootId
        ? `https://drive.google.com/drive/folders/${rootId}`
        : 'https://drive.google.com/drive/my-drive';
      if (Platform.OS === 'web') {
        window.open(folderUrl, '_blank');
      } else {
        Linking.openURL(folderUrl).catch((err) =>
          console.warn('Could not open drive URL:', err)
        );
      }
    } catch {
      const folderUrl = 'https://drive.google.com/drive/my-drive';
      if (Platform.OS === 'web') {
        window.open(folderUrl, '_blank');
      } else {
        Linking.openURL(folderUrl).catch(() => {});
      }
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Pressable
          onPress={() => setActiveTab('dashboard')}
          style={({ pressed }) => [
            styles.backBtn,
            { backgroundColor: theme.surfaceSubtle, borderColor: theme.border },
            pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] },
          ]}
          hitSlop={8}
          accessibilityLabel="Back to Dashboard"
        >
          <Ionicons name="arrow-back" size={20} color={theme.text} />
        </Pressable>

        <Text
          style={[styles.headerTitle, { color: theme.text }]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {t('settingsTitle')}
        </Text>

        <Pressable
          onPress={handleSave}
          disabled={isSaving}
          style={({ pressed }) => [
            styles.saveBtn,
            { backgroundColor: theme.primary },
            (pressed || isSaving) && { opacity: 0.85, transform: [{ scale: 0.97 }] },
          ]}
        >
          <Ionicons
            name={isSaving ? 'hourglass-outline' : 'checkmark'}
            size={15}
            color="#FFFFFF"
          />
          <Text style={styles.saveBtnText}>{isSaving ? '...' : t('save')}</Text>
        </Pressable>
      </View>

      {/* ── Google Cloud Quick Status Banner ─────────────────────────────── */}
      <Pressable
        onPress={() => setIsAuthModalOpen(true)}
        style={({ pressed }) => [
          styles.cloudTopBanner,
          {
            backgroundColor: user
              ? (settings.darkMode ? '#064E3B22' : '#F0FDF4')
              : (settings.darkMode ? '#1E293B' : '#F8FAFC'),
            borderColor: user ? '#86EFAC' : theme.border,
          },
          pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
        ]}
      >
        <View style={styles.cloudTopBannerLeft}>
          <View style={[styles.cloudTopIcon, { backgroundColor: user ? '#DCFCE7' : theme.primaryLight }]}>
            <Ionicons
              name={user ? 'cloud-done' : 'cloud-upload'}
              size={18}
              color={user ? '#15803D' : theme.primary}
            />
          </View>
          <View style={styles.cloudTopTextWrap}>
            <Text style={[styles.cloudTopTitle, { color: theme.text }]} numberOfLines={1}>
              {user ? (user.displayName || user.email) : (language === 'ur' ? 'گوگل کلاؤڈ بیک اپ' : 'Google Cloud Backup')}
            </Text>
            <Text style={[styles.cloudTopSub, { color: user ? '#16A34A' : theme.textMuted }]} numberOfLines={1}>
              {user
                ? (syncStatus === 'syncing' ? 'Syncing with cloud...' : 'Connected & Backed Up to Firebase')
                : (language === 'ur' ? 'ڈیٹا محفوظ کرنے کیلئے گوگل سے لاگ ان کریں' : 'Tap to connect & sync your store records')}
            </Text>
          </View>
        </View>
        <View style={styles.cloudTopBannerRight}>
          <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
        </View>
      </Pressable>

      {/* ── Segment Switcher ───────────────────────────────────────────────── */}
      <View style={[styles.segmentWrap, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
        {(['profile', 'settings'] as const).map((seg) => (
          <Pressable
            key={seg}
            onPress={() => setActiveSegment(seg)}
            style={[
              styles.segBtn,
              activeSegment === seg && [styles.segBtnActive, { backgroundColor: theme.surface, ...Shadows.sm }],
            ]}
          >
            <Ionicons
              name={seg === 'profile' ? 'person' : 'settings'}
              size={15}
              color={activeSegment === seg ? theme.primary : theme.textMuted}
            />
            <Text
              style={[
                styles.segBtnText,
                { color: activeSegment === seg ? theme.primary : theme.textMuted },
                activeSegment === seg && { fontWeight: '700' },
              ]}
            >
              {seg === 'profile' ? t('profileTab') : t('preferencesTab')}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* ════════════════════════ PROFILE TAB ════════════════════════════════ */}
      {activeSegment === 'profile' && (
        <>
          {/* Avatar Card */}
          <View style={[styles.avatarCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            {/* Avatar */}
            <View style={styles.avatarRow}>
              <Pressable onPress={pickImage} style={styles.avatarTapArea}>
                {profileImage && !isGoogleAvatar(profileImage) ? (
                  <Image source={{ uri: profileImage }} style={[styles.avatar, { borderColor: theme.primary }]} />
                ) : (
                  <View style={[styles.avatarFallback, { backgroundColor: theme.primaryLight, borderColor: theme.primary }]}>
                    <Ionicons name="storefront" size={34} color={theme.primary} />
                  </View>
                )}
                <View style={[styles.cameraBadge, { backgroundColor: theme.primary }]}>
                  <Ionicons name="camera" size={13} color="#fff" />
                </View>
              </Pressable>

              <View style={styles.avatarInfo}>
                <Text style={[styles.avatarName, { color: theme.text }]} numberOfLines={1}>
                  {ownerName || user?.displayName || 'Proprietor Name'}
                </Text>
                <Text style={[styles.avatarShop, { color: theme.primary }]} numberOfLines={1}>
                  {(language === 'ur' && shopNameUrdu) ? shopNameUrdu : shopName || 'Store Name'}
                </Text>
                <Text style={[styles.avatarType, { color: theme.textMuted }]}>{businessType}</Text>
                {user ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                    <Ionicons name="logo-google" size={12} color="#0284C7" />
                    <Text style={{ fontSize: 11, color: '#0284C7', fontWeight: '600' }} numberOfLines={1}>
                      {user.displayName ? `${user.displayName} • ${user.email}` : user.email}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* Photo Action Buttons */}
            <View style={styles.photoActions}>
              {user && (
                <Pressable
                  onPress={() => {
                    if (user.displayName) {
                      setOwnerName(user.displayName);
                      if (!shopName || shopName === 'My Store' || shopName === 'Madina Super Store') {
                        setShopName(`${user.displayName}'s Store`);
                      }
                      if (!shopNameUrdu || shopNameUrdu === 'میری دکان' || shopNameUrdu === 'مدینہ سپر اسٹور اینڈ کریانہ') {
                        setShopNameUrdu(`${user.displayName} اسٹور`);
                      }
                    }
                    if (user.email) setEmail(user.email);
                  }}
                  style={[styles.photoBtn, { backgroundColor: '#E0F2FE', borderWidth: 1, borderColor: '#7DD3FC' }]}
                >
                  <Ionicons name="logo-google" size={14} color="#0284C7" />
                  <Text style={[styles.photoBtnText, { color: '#0284C7', fontWeight: '700' }]}>
                    {language === 'ur' ? 'گوگل پروفائل حاصل کریں' : 'Sync Google Info'}
                  </Text>
                </Pressable>
              )}
              <Pressable
                onPress={() => setIsCameraOpen(true)}
                style={[styles.photoBtn, { backgroundColor: theme.primaryLight }]}
              >
                <Ionicons name="camera-outline" size={15} color={theme.primary} />
                <Text style={[styles.photoBtnText, { color: theme.primary }]}>{t('takePhoto')}</Text>
              </Pressable>
              <Pressable
                onPress={pickImage}
                style={[styles.photoBtn, { backgroundColor: theme.surfaceSubtle, borderWidth: 1, borderColor: theme.border }]}
              >
                <Ionicons name="images-outline" size={15} color={theme.textSecondary} />
                <Text style={[styles.photoBtnText, { color: theme.textSecondary }]}>{t('chooseGallery')}</Text>
              </Pressable>
              {profileImage && !isGoogleAvatar(profileImage) ? (
                <Pressable
                  onPress={() => setProfileImage('')}
                  style={[styles.photoBtn, { backgroundColor: theme.dangerLight }]}
                >
                  <Ionicons name="trash-outline" size={14} color={theme.danger} />
                  <Text style={[styles.photoBtnText, { color: theme.danger }]}>{t('removePhoto')}</Text>
                </Pressable>
              ) : null}
            </View>

            {/* Stats Strip */}
            <View style={[styles.statsStrip, { borderTopColor: theme.border }]}>
              {[
                { label: t('statsProducts'), value: String(products.length), color: theme.primary },
                { label: t('statsSales'), value: `${settings.currencySymbol} ${todaySalesTotal.toLocaleString()}`, color: theme.success },
                { label: t('statsKhata'), value: String(khata.length), color: theme.accent },
              ].map((s, i, arr) => (
                <React.Fragment key={s.label}>
                  <View style={styles.statItem}>
                    <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
                    <Text style={[styles.statLabel, { color: theme.textMuted }]}>{s.label}</Text>
                  </View>
                  {i < arr.length - 1 && <View style={[styles.statDivider, { backgroundColor: theme.border }]} />}
                </React.Fragment>
              ))}
            </View>
          </View>

          {/* Store Info */}
          <Section title={t('identitySection')} theme={theme}>
            <RowItem icon="storefront-outline" iconColor={theme.primary} iconBg={theme.primaryLight} label={t('ownerNameLabel')} theme={theme}>
              <InlineField value={ownerName} onChangeText={setOwnerName} onSubmitEditing={handleSave} placeholder={user?.displayName || "e.g. Shop Owner"} theme={theme} />
            </RowItem>
            <RowItem icon="business-outline" iconColor={theme.primary} iconBg={theme.primaryLight} label={t('shopNameLabel')} theme={theme}>
              <InlineField value={shopName} onChangeText={setShopName} onSubmitEditing={handleSave} placeholder={user?.displayName ? `${user.displayName}'s Store` : "e.g. My Store"} theme={theme} />
            </RowItem>
            <RowItem icon="text-outline" iconColor={theme.primary} iconBg={theme.primaryLight} label={t('shopNameUrduLabel')} theme={theme} last>
              <InlineField value={shopNameUrdu} onChangeText={setShopNameUrdu} onSubmitEditing={handleSave} placeholder={user?.displayName ? `${user.displayName} اسٹور` : "مثلاً: میری دکان"} theme={theme} />
            </RowItem>
          </Section>

          {/* Quick Save Store Identity Action */}
          <View style={styles.quickSaveContainer}>
            <Pressable
              onPress={handleSave}
              disabled={isSaving}
              style={({ pressed }) => [
                styles.quickSaveBannerBtn,
                { backgroundColor: theme.primary },
                pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] },
              ]}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
                  <Text style={styles.quickSaveBannerBtnText}>
                    {language === 'ur' ? 'دکان کا نام محفوظ کریں' : 'Save Store Name'}
                  </Text>
                </>
              )}
            </Pressable>
          </View>

          {/* Contact */}
          <Section title={t('contactSection')} theme={theme}>
            <RowItem icon="call-outline" iconColor="#0284C7" iconBg="#E0F2FE" label={t('phoneLabel')} theme={theme}>
              <InlineField value={phone} onChangeText={setPhone} placeholder="0300-1234567" keyboardType="phone-pad" theme={theme} />
            </RowItem>
            <RowItem icon="phone-portrait-outline" iconColor="#0284C7" iconBg="#E0F2FE" label={t('altPhoneLabel')} theme={theme}>
              <InlineField value={alternatePhone} onChangeText={setAlternatePhone} placeholder="0321-9876543" keyboardType="phone-pad" theme={theme} />
            </RowItem>
            <RowItem icon="mail-outline" iconColor="#7C3AED" iconBg="#EDE9FE" label={t('emailLabel')} theme={theme}>
              <InlineField value={email} onChangeText={setEmail} placeholder="store@gmail.com" keyboardType="email-address" theme={theme} />
            </RowItem>
            <RowItem icon="location-outline" iconColor="#D97706" iconBg="#FEF3C7" label={t('cityLabel')} theme={theme}>
              <InlineField value={city} onChangeText={setCity} placeholder="e.g. Lahore" theme={theme} />
            </RowItem>
            <RowItem icon="map-outline" iconColor="#D97706" iconBg="#FEF3C7" label={t('addressLabel')} theme={theme} last>
              <InlineField value={address} onChangeText={setAddress} placeholder="Shop #14, Market" theme={theme} />
            </RowItem>
          </Section>

          {/* Payment & Tax */}
          <Section title={t('paymentSection')} theme={theme}>
            <RowItem icon="wallet-outline" iconColor="#059669" iconBg="#D1FAE5" label={t('paymentDetailsLabel')} theme={theme}>
              <InlineField value={paymentDetails} onChangeText={setPaymentDetails} placeholder="EasyPaisa: 0300-…" theme={theme} />
            </RowItem>
            <RowItem icon="document-text-outline" iconColor="#059669" iconBg="#D1FAE5" label={t('taxNumberLabel')} theme={theme}>
              <InlineField value={taxNumber} onChangeText={setTaxNumber} placeholder="NTN-XXXXXXX-X" theme={theme} />
            </RowItem>
            <RowItem icon="time-outline" iconColor="#059669" iconBg="#D1FAE5" label={t('businessHoursLabel')} theme={theme} last>
              <InlineField value={businessHours} onChangeText={setBusinessHours} placeholder="08:00 AM – 11:30 PM" theme={theme} />
            </RowItem>
          </Section>

          {/* Save */}
          <Pressable
            onPress={handleSave}
            disabled={isSaving}
            style={({ pressed }) => [
              styles.fullSaveBtn,
              { backgroundColor: theme.primary },
              (pressed || isSaving) && { opacity: 0.8 },
            ]}
          >
            <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
            <Text style={styles.fullSaveBtnText}>{t('saveSettings')}</Text>
          </Pressable>
        </>
      )}

      {/* ════════════════════════ SETTINGS TAB ═══════════════════════════════ */}
      {activeSegment === 'settings' && (
        <>
          {/* Appearance */}
          <Section title="Appearance" theme={theme}>
            {/* Language */}
            <RowItem icon="language-outline" iconColor="#7C3AED" iconBg="#EDE9FE" label={t('languageLabel')} sublabel="English / اردو" theme={theme}>
              <View style={styles.langToggle}>
                {(['en', 'ur'] as const).map((lang) => (
                  <Pressable
                    key={lang}
                    onPress={() => setLanguage(lang)}
                    style={[
                      styles.langChip,
                      {
                        backgroundColor: language === lang ? theme.primary : theme.surfaceSubtle,
                        borderColor: language === lang ? theme.primary : theme.border,
                      },
                    ]}
                  >
                    <Text style={[styles.langChipText, { color: language === lang ? '#fff' : theme.textSecondary }]}>
                      {lang === 'en' ? 'EN' : 'اردو'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </RowItem>

            {/* Dark Mode */}
            <RowItem icon="moon-outline" iconColor="#6366F1" iconBg="#E0E7FF" label={t('darkModeLabel')} sublabel={settings.darkMode ? 'Dark' : 'Light'} theme={theme} last>
              <Switch
                value={settings.darkMode}
                onValueChange={(val) => updateSettings({ darkMode: val })}
                trackColor={{ false: theme.border, true: theme.primary }}
                thumbColor="#fff"
              />
            </RowItem>
          </Section>

          {/* Billing */}
          <Section title={t('billingSection')} theme={theme}>
            <RowItem icon="cash-outline" iconColor="#059669" iconBg="#D1FAE5" label={t('currencyLabel')} theme={theme}>
              <InlineField value={currencySymbol} onChangeText={setCurrencySymbol} placeholder="Rs" theme={theme} />
            </RowItem>
            <RowItem icon="alert-circle-outline" iconColor="#D97706" iconBg="#FEF3C7" label={t('lowStockThresholdLabel')} theme={theme}>
              <InlineField value={lowStockThreshold} onChangeText={setLowStockThreshold} keyboardType="numeric" placeholder="5" theme={theme} />
            </RowItem>
            <RowItem icon="receipt-outline" iconColor="#0284C7" iconBg="#E0F2FE" label={t('billFooterLabel')} theme={theme}>
              <InlineField value={footerNote} onChangeText={setFooterNote} placeholder="Thank you!" theme={theme} />
            </RowItem>
            <RowItem icon="language-outline" iconColor="#0284C7" iconBg="#E0F2FE" label={t('billFooterUrduLabel')} theme={theme} last>
              <InlineField value={footerNoteUrdu} onChangeText={setFooterNoteUrdu} placeholder="شکریہ" theme={theme} />
            </RowItem>
          </Section>

          {/* Save Preferences */}
          <Pressable
            onPress={handleSave}
            disabled={isSaving}
            style={({ pressed }) => [
              styles.fullSaveBtn,
              { backgroundColor: theme.primary },
              (pressed || isSaving) && { opacity: 0.8 },
            ]}
          >
            <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
            <Text style={styles.fullSaveBtnText}>{t('saveSettings')}</Text>
          </Pressable>

          {/* Google Cloud Backup & Account Section */}
          <Section title={t('googleAccount')} theme={theme}>
            {!user ? (
              <View style={styles.googleAuthCard}>
                <View style={styles.googleHeaderRow}>
                  <View style={styles.googleIconCircle}>
                    <Ionicons name="logo-google" size={22} color="#EA4335" />
                  </View>
                  <View style={styles.googleTextWrap}>
                    <Text style={[styles.googleTitle, { color: theme.text }]}>
                      {t('googleAccount')}
                    </Text>
                    <Text style={[styles.googleDesc, { color: theme.textMuted }]}>
                      {t('googleSyncDesc')}
                    </Text>
                  </View>
                </View>

                <Pressable
                  onPress={handleGoogleSignIn}
                  disabled={googleLoading || authLoading}
                  style={({ pressed }) => [
                    styles.googleSignInBtn,
                    (pressed || googleLoading) && { opacity: 0.85 },
                  ]}
                >
                  <Ionicons name="logo-google" size={18} color="#fff" />
                  <Text style={styles.googleSignInBtnText}>
                    {googleLoading ? t('syncing') : t('continueWithGoogle')}
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.googleProfileCard}>
                <View style={styles.googleUserRow}>
                  {user.photoURL ? (
                    <Image source={{ uri: user.photoURL }} style={styles.googleAvatar} />
                  ) : (
                    <View style={[styles.googleAvatarFallback, { backgroundColor: theme.primaryLight }]}>
                      <Text style={[styles.googleAvatarText, { color: theme.primary }]}>
                        {(user.displayName || user.email || 'G')[0].toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={styles.googleUserInfo}>
                    <Text style={[styles.googleUserName, { color: theme.text }]} numberOfLines={1}>
                      {user.displayName || 'Google User'}
                    </Text>
                    <Text style={[styles.googleUserEmail, { color: theme.textMuted }]} numberOfLines={1}>
                      {user.email}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.syncBadge,
                      syncStatus === 'synced' && { backgroundColor: '#DCFCE7', borderColor: '#86EFAC' },
                      syncStatus === 'syncing' && { backgroundColor: '#E0F2FE', borderColor: '#7DD3FC' },
                      syncStatus === 'error' && { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' },
                      syncStatus === 'idle' && { backgroundColor: theme.surfaceSubtle, borderColor: theme.border },
                    ]}
                  >
                    <Ionicons
                      name={
                        syncStatus === 'synced'
                          ? 'cloud-done'
                          : syncStatus === 'syncing'
                          ? 'cloud-upload'
                          : syncStatus === 'error'
                          ? 'alert-circle'
                          : 'cloud-outline'
                      }
                      size={13}
                      color={
                        syncStatus === 'synced'
                          ? '#15803D'
                          : syncStatus === 'syncing'
                          ? '#0284C7'
                          : syncStatus === 'error'
                          ? '#B91C1C'
                          : theme.textMuted
                      }
                    />
                    <Text
                      style={[
                        styles.syncBadgeText,
                        {
                          color:
                            syncStatus === 'synced'
                              ? '#15803D'
                              : syncStatus === 'syncing'
                              ? '#0284C7'
                              : syncStatus === 'error'
                              ? '#B91C1C'
                              : theme.textMuted,
                        },
                      ]}
                    >
                      {syncStatus === 'synced'
                        ? t('synced')
                        : syncStatus === 'syncing'
                        ? t('syncing')
                        : syncStatus === 'error'
                        ? t('syncError')
                        : 'Ready'}
                    </Text>
                  </View>
                </View>

                {/* Cloud Action Buttons */}
                <View style={styles.googleActionsRow}>
                  <Pressable
                    onPress={handleSyncNow}
                    disabled={syncStatus === 'syncing'}
                    style={({ pressed }) => [
                      styles.syncActionBtn,
                      { backgroundColor: theme.primaryLight },
                      pressed && { opacity: 0.8 },
                    ]}
                  >
                    <Ionicons name="sync-outline" size={15} color={theme.primary} />
                    <Text style={[styles.syncActionBtnText, { color: theme.primary }]}>
                      {t('syncNow')}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={handleLogout}
                    style={({ pressed }) => [
                      styles.signOutActionBtn,
                      { backgroundColor: theme.surfaceSubtle, borderColor: theme.border, borderWidth: 1 },
                      pressed && { opacity: 0.8 },
                    ]}
                  >
                    <Ionicons name="log-out-outline" size={15} color={theme.text} />
                    <Text style={[styles.signOutActionBtnText, { color: theme.text }]}>
                      {t('signOut')}
                    </Text>
                  </Pressable>
                </View>

                {/* Account & Data Deletion */}
                <Pressable
                  onPress={handleDeleteAccount}
                  disabled={isDeletingAccount}
                  style={({ pressed }) => [
                    styles.deleteAccountBtn,
                    { backgroundColor: theme.dangerLight, borderColor: '#FCA5A5', borderWidth: 1 },
                    (pressed || isDeletingAccount) && { opacity: 0.8 },
                  ]}
                >
                  {isDeletingAccount ? (
                    <ActivityIndicator size="small" color={theme.danger} />
                  ) : (
                    <Ionicons name="trash-outline" size={14} color={theme.danger} />
                  )}
                  <Text style={[styles.deleteAccountBtnText, { color: theme.danger }]}>
                    {isDeletingAccount ? t('deletingAccount') : t('deleteAccount')}
                  </Text>
                </Pressable>

              </View>
            )}
          </Section>

          {/* Google Drive (5 TB Storage) Section */}
          <Section title={t('googleDriveTitle')} theme={theme}>
            <View style={styles.driveCard}>
              <View style={styles.driveHeaderRow}>
                <View style={styles.driveIconCircle}>
                  <Ionicons name="logo-google" size={22} color="#0F9D58" />
                </View>
                <View style={styles.driveTextWrap}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[styles.driveTitle, { color: theme.text }]}>
                      {t('googleDriveTitle')}
                    </Text>
                  </View>
                  <Text style={[styles.driveDesc, { color: theme.textMuted }]}>
                    {driveAuth
                      ? (language === 'ur'
                          ? `منسلک: ${driveAuth.email || 'Google Drive'} — تصاویر اور بیک اپ ڈرائیو میں محفوظ ہو رہے ہیں`
                          : `Connected: ${driveAuth.email || 'Google Drive'} — Photos & backups saving to Drive`)
                      : t('googleDriveDesc')}
                  </Text>
                </View>
              </View>

              {driveAuth ? (
                <View style={styles.driveConnectedContent}>
                  {/* Folder Row */}
                  <View style={[styles.driveFolderInfoRow, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
                    <Ionicons name="folder" size={16} color="#0F9D58" />
                    <Text style={[styles.driveFolderName, { color: theme.textSecondary }]} numberOfLines={1}>
                      {language === 'ur' ? 'فولڈر: Shopkeeper_Store_Data' : 'Folder: Shopkeeper_Store_Data'}
                    </Text>
                    <Pressable
                      onPress={handleOpenDriveFolder}
                      style={styles.driveOpenLinkBtn}
                    >
                      <Text style={styles.driveOpenLinkText}>
                        {language === 'ur' ? 'ڈرائیو کھولیں ↗' : 'Open in Drive ↗'}
                      </Text>
                    </Pressable>
                  </View>

                  {/* Backup Success Notice */}
                  {driveBackupSuccess && (
                    <View style={styles.backupSuccessNotice}>
                      <Ionicons name="checkmark-circle" size={14} color="#15803D" />
                      <Text style={styles.backupSuccessNoticeText}>
                        {t('backupToDriveSuccess')} ({driveBackupSuccess})
                      </Text>
                    </View>
                  )}

                  {/* Actions Row */}
                  <View style={styles.driveActionButtonsRow}>
                    <Pressable
                      onPress={handleBackupToDrive}
                      disabled={driveBackupLoading}
                      style={({ pressed }) => [
                        styles.driveBackupBtn,
                        { backgroundColor: '#0F9D58' },
                        (pressed || driveBackupLoading) && { opacity: 0.85 },
                      ]}
                    >
                      {driveBackupLoading ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Ionicons name="cloud-upload" size={16} color="#fff" />
                      )}
                      <Text style={styles.driveBackupBtnText}>
                        {driveBackupLoading ? t('backingUpToDrive') : t('backupToDrive')}
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={handleDisconnectDrive}
                      style={({ pressed }) => [
                        styles.driveDisconnectBtn,
                        { borderColor: theme.border },
                        pressed && { opacity: 0.8 },
                      ]}
                    >
                      <Text style={[styles.driveDisconnectText, { color: theme.danger }]}>
                        {t('disconnectDrive')}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Pressable
                  onPress={handleConnectDrive}
                  disabled={driveLoading}
                  style={({ pressed }) => [
                    styles.driveConnectBtn,
                    { backgroundColor: '#0F9D58' },
                    (pressed || driveLoading) && { opacity: 0.85 },
                  ]}
                >
                  {driveLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
                  )}
                  <Text style={styles.driveConnectBtnText}>
                    {driveLoading ? 'Connecting...' : t('connectDrive')}
                  </Text>
                </Pressable>
              )}
            </View>
          </Section>

          {/* Data Management */}
          <Section title={t('dataManagement')} theme={theme}>
            <RowItem
              icon="download-outline"
              iconColor="#059669"
              iconBg="#D1FAE5"
              label={t('backupBtn')}
              sublabel="Export all data as JSON"
              onPress={handleExport}
              theme={theme}
            />
            <RowItem
              icon="cloud-upload-outline"
              iconColor="#0284C7"
              iconBg="#E0F2FE"
              label={t('restoreBtn')}
              sublabel="Import from JSON backup"
              onPress={() => setShowImportBox(!showImportBox)}
              theme={theme}
            />
            <RowItem
              icon="trash-outline"
              iconColor="#DC2626"
              iconBg="#FEE2E2"
              label={t('resetSampleBtn')}
              sublabel={language === 'ur' ? 'تمام اشیاء، بل اور کھاتہ صاف کریں' : 'Wipe products, bills & khata'}
              onPress={handleReset}
              theme={theme}
              last
            />
          </Section>

          {/* Import Box */}
          {showImportBox && (
            <View style={[styles.importBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.importHint, { color: theme.textSecondary }]}>
                Paste your backup JSON below to restore:
              </Text>
              <Pressable
                onPress={() => setImportJsonText(buildImportTemplateJSON())}
                style={[styles.importTemplateBtn, { borderColor: theme.primary }]}
              >
                <Ionicons name="document-text-outline" size={15} color={theme.primary} />
                <Text style={[styles.importTemplateText, { color: theme.primary }]}>
                  Fill sample template (products only)
                </Text>
              </Pressable>
              <TextInput
                value={importJsonText}
                onChangeText={setImportJsonText}
                placeholder={'{"products": [...], ...}'}
                placeholderTextColor={theme.textMuted}
                multiline
                style={[
                  styles.importInput,
                  {
                    color: theme.text,
                    backgroundColor: theme.surfaceSubtle,
                    borderColor: theme.border,
                  },
                ]}
              />
              <Pressable
                onPress={handleImport}
                style={[styles.importApplyBtn, { backgroundColor: theme.primary }]}
              >
                <Text style={styles.importApplyText}>Apply Restore</Text>
              </Pressable>
            </View>
          )}
          {/* About & Legal Section */}
          <Section title={t('aboutLegal')} theme={theme}>
            <RowItem
              icon="shield-checkmark-outline"
              iconColor="#2563EB"
              iconBg="#DBEAFE"
              label={t('privacyPolicy')}
              sublabel="View official privacy disclosures"
              onPress={() => openLegalUrl(LEGAL_CONFIG.privacyPolicyUrl)}
              theme={theme}
            />
            <RowItem
              icon="document-text-outline"
              iconColor="#0D9488"
              iconBg="#CCFBF1"
              label={t('termsOfService')}
              sublabel="View terms of service"
              onPress={() => openLegalUrl(LEGAL_CONFIG.termsOfServiceUrl)}
              theme={theme}
            />
            <RowItem
              icon="trash-bin-outline"
              iconColor="#DC2626"
              iconBg="#FEE2E2"
              label="Account & Data Deletion Portal"
              sublabel="Online data erasure request"
              onPress={() => openLegalUrl(LEGAL_CONFIG.accountDeletionUrl)}
              theme={theme}
            />
            <RowItem
              icon="information-circle-outline"
              iconColor="#64748B"
              iconBg="#F1F5F9"
              label="App Version"
              sublabel={`v${LEGAL_CONFIG.appVersion} (${LEGAL_CONFIG.packageName})`}
              theme={theme}
              last
            />
          </Section>

        </>
      )}

      {/* Bottom padding */}
      <View style={{ height: 40 }} />

      {/* Camera Modal */}
      <CameraModal
        visible={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={(uri) => { handleLogoSelected(uri); setIsCameraOpen(false); }}
        title={t('takePhoto')}
      />
    </ScrollView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.lg, paddingBottom: 80 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    ...Shadows.sm,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },

  // Segment
  segmentWrap: {
    flexDirection: 'row',
    borderRadius: BorderRadius.full,
    padding: 4,
    borderWidth: 1,
    marginBottom: Spacing.lg,
    gap: 4,
  },
  segBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: BorderRadius.full,
  },
  segBtnActive: {},
  segBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Avatar Card
  avatarCard: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    marginBottom: Spacing.lg,
    overflow: 'hidden',
    ...Shadows.md,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
  },
  avatarTapArea: {
    position: 'relative',
    width: 80,
    height: 80,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2.5,
  },
  avatarFallback: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  avatarInitials: {
    fontSize: 26,
    fontWeight: '900',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  avatarInfo: { flex: 1, gap: 2 },
  avatarName: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  avatarShop: { fontSize: 14, fontWeight: '600' },
  avatarType: { fontSize: 12 },

  // Photo actions
  photoActions: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    flexWrap: 'wrap',
  },
  photoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: BorderRadius.full,
  },
  photoBtnText: { fontSize: 12, fontWeight: '700' },

  // Stats
  statsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    paddingVertical: Spacing.md,
  },
  statItem: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { fontSize: 15, fontWeight: '900' },
  statLabel: { fontSize: 11, fontWeight: '500' },
  statDivider: { width: 1, height: 28 },

  // Section
  sectionWrap: { marginBottom: Spacing.lg },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 6,
    marginLeft: 4,
  },
  sectionCard: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    overflow: 'hidden',
    ...Shadows.sm,
  },

  // Row Item
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
    minHeight: 54,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabelWrap: { flex: 1 },
  rowLabel: { fontSize: 15, fontWeight: '500' },
  rowSub: { fontSize: 12, marginTop: 1 },
  rowRight: { flex: 1, maxWidth: '65%', alignItems: 'flex-end' },

  // Inline input
  inlineInput: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
    minWidth: 120,
    maxWidth: 280,
    width: '100%',
  },

  // Quick save button under store identity
  quickSaveContainer: {
    paddingHorizontal: Spacing.xs,
    marginTop: -Spacing.xs,
    marginBottom: Spacing.lg,
  },
  quickSaveBannerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    ...Shadows.sm,
  },
  quickSaveBannerBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  // Language chips
  langToggle: { flexDirection: 'row', gap: 6 },
  langChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
  },
  langChipText: { fontSize: 12, fontWeight: '700' },

  // Save button
  fullSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.lg,
    ...Shadows.lg,
  },
  fullSaveBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },

  // Import box
  importBox: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.md,
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  importHint: { fontSize: 13, fontWeight: '500' },
  importTemplateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  importTemplateText: { fontSize: 13, fontWeight: '700' },
  importInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    minHeight: 100,
    fontSize: 13,
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
    textAlignVertical: 'top',
  },
  importApplyBtn: {
    paddingVertical: 13,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    ...Shadows.sm,
  },
  importApplyText: { color: '#fff', fontWeight: '800', fontSize: 13 },

  // Google Auth & Cloud Backup styles
  googleAuthCard: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  googleHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  googleIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleTextWrap: {
    flex: 1,
  },
  googleTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  googleDesc: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  googleSignInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#4285F4',
    paddingVertical: 12,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
    marginTop: 4,
    ...Shadows.sm,
  },
  googleSignInBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  googleProfileCard: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  googleUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  googleAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  googleAvatarFallback: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleAvatarText: {
    fontSize: 18,
    fontWeight: '700',
  },
  googleUserInfo: {
    flex: 1,
  },
  googleUserName: {
    fontSize: 15,
    fontWeight: '700',
  },
  googleUserEmail: {
    fontSize: 12,
    marginTop: 1,
  },
  syncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  syncBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  googleActionsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.xs,
  },
  syncActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: BorderRadius.full,
  },
  syncActionBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  signOutActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
  },
  signOutActionBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  deleteAccountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.xs,
  },
  deleteAccountBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },

  cloudTopBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  cloudTopBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  cloudTopIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cloudTopTextWrap: {
    flex: 1,
  },
  cloudTopTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  cloudTopSub: {
    fontSize: 12,
    marginTop: 1,
  },
  cloudTopBannerRight: {
    marginLeft: Spacing.sm,
  },

  // 5 TB Google Drive Styles
  driveCard: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  driveHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  driveIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  driveTextWrap: {
    flex: 1,
  },
  driveTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  driveStoragePill: {
    backgroundColor: '#0F9D58',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  driveStoragePillText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  driveDesc: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  driveConnectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
    marginTop: 4,
    ...Shadows.sm,
  },
  driveConnectBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  driveConnectedContent: {
    gap: Spacing.md,
    marginTop: 4,
  },
  driveFolderInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: 8,
  },
  driveFolderName: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
  },
  driveOpenLinkBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  driveOpenLinkText: {
    color: '#0F9D58',
    fontSize: 12,
    fontWeight: '700',
  },
  backupSuccessNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
  },
  backupSuccessNoticeText: {
    color: '#15803D',
    fontSize: 12,
    fontWeight: '600',
  },
  driveActionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  driveBackupBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: BorderRadius.full,
    ...Shadows.sm,
  },
  driveBackupBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  driveDisconnectBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  driveDisconnectText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
