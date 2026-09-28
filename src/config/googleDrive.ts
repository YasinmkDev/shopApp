/**
 * Configuration for Google Drive 5 TB Integration
 */
export const GOOGLE_DRIVE_CONFIG = {
  clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '',
  projectId: process.env.EXPO_PUBLIC_GOOGLE_PROJECT_ID || 'shopkeeper-509318',
  scopes: [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
  ],
  folderName: 'Shopkeeper_Store_Data',
  imagesFolderName: 'Images',
  backupsFolderName: 'Backups',
  billsFolderName: 'Bills',
  defaultFolderId: process.env.EXPO_PUBLIC_GOOGLE_DRIVE_DEFAULT_FOLDER_ID || '',
  storageKey: '@shopkeeper_google_drive_auth',
};
