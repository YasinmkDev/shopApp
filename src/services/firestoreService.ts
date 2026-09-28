import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  deleteDoc, 
  writeBatch,
  getDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { db, storage } from '@/config/firebase';
import { ref, listAll, deleteObject } from 'firebase/storage';

import { Product, Sale, CustomerKhata, KhataTransaction, Payment, ShopSettings, SyncQueueItem } from '@/types';

/**
 * Path helpers for multi-tenant Firestore structure:
 * shops/{userId}/products/{id}
 * shops/{userId}/sales/{id}
 * shops/{userId}/customers/{id}
 * shops/{userId}/khata_transactions/{id}
 * shops/{userId}/payments/{id}
 * shops/{userId}/settings/profile
 */
export const getShopCollection = (userId: string, collectionName: string) => {
  return collection(db, 'shops', userId, collectionName);
};

export const getShopDoc = (userId: string, collectionName: string, docId: string) => {
  return doc(db, 'shops', userId, collectionName, docId);
};

// Utility to recursively strip undefined properties so Firestore writes never throw
export function cleanData<T>(obj: T): T {
  if (obj === undefined || obj === null) return obj;
  if (Array.isArray(obj)) {
    return obj.map((item) => cleanData(item)) as unknown as T;
  }
  if (typeof obj === 'object' && !(obj instanceof Date)) {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = cleanData(value);
      }
    }
    return cleaned;
  }
  return obj;
}

// ==================== PRODUCTS ====================

export async function saveProductToCloud(userId: string, product: Product): Promise<void> {
  if (!userId) return;
  const productRef = getShopDoc(userId, 'products', product.id);
  const data = cleanData({
    ...product,
    syncedAt: serverTimestamp(),
  });
  await setDoc(productRef, data, { merge: true });
}

export async function deleteProductFromCloud(userId: string, productId: string): Promise<void> {
  if (!userId) return;
  const productRef = getShopDoc(userId, 'products', productId);
  await deleteDoc(productRef);
}

export async function fetchProductsFromCloud(userId: string): Promise<Product[]> {
  if (!userId) return [];
  const colRef = getShopCollection(userId, 'products');
  const snapshot = await getDocs(colRef);
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      name: data.name,
      nameUrdu: data.nameUrdu,
      image: data.image || data.imageUri,
      imageUri: data.imageUri || data.image,
      price: data.sellingPrice ?? data.price,
      sellingPrice: data.sellingPrice ?? data.price,
      costPrice: data.costPrice ?? 0,
      stock: data.stock ?? 0,
      category: data.category || 'Others',
      barcode: data.barcode,
      unit: data.unit || 'piece',
      lowStockThreshold: data.lowStockThreshold ?? 5,
      createdAt: data.createdAt || Date.now(),
      updatedAt: data.updatedAt || Date.now(),
      deletedAt: data.deletedAt || null,
      syncStatus: 'synced',
    } as Product;
  });
}

// ==================== SALES ====================

export async function saveSaleToCloud(userId: string, sale: Sale): Promise<void> {
  if (!userId) return;
  const saleRef = getShopDoc(userId, 'sales', sale.id);
  const data = cleanData({
    ...sale,
    syncedAt: serverTimestamp(),
  });
  await setDoc(saleRef, data, { merge: true });
}

export async function deleteSaleFromCloud(userId: string, saleId: string): Promise<void> {
  if (!userId) return;
  const saleRef = getShopDoc(userId, 'sales', saleId);
  await deleteDoc(saleRef);
}

export async function fetchSalesFromCloud(userId: string): Promise<Sale[]> {
  if (!userId) return [];
  const colRef = getShopCollection(userId, 'sales');
  const snapshot = await getDocs(colRef);
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      ...data,
      id: docSnap.id,
      syncStatus: 'synced',
    } as Sale;
  });
}

// ==================== CUSTOMERS & KHATA ====================

export async function saveCustomerToCloud(userId: string, customer: CustomerKhata): Promise<void> {
  if (!userId) return;
  const custRef = getShopDoc(userId, 'customers', customer.id);
  const data = cleanData({
    ...customer,
    syncedAt: serverTimestamp(),
  });
  await setDoc(custRef, data, { merge: true });
}

export async function fetchCustomersFromCloud(userId: string): Promise<CustomerKhata[]> {
  if (!userId) return [];
  const colRef = getShopCollection(userId, 'customers');
  const snapshot = await getDocs(colRef);
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      ...data,
      id: docSnap.id,
      syncStatus: 'synced',
    } as CustomerKhata;
  });
}

export async function saveKhataTxToCloud(userId: string, tx: KhataTransaction): Promise<void> {
  if (!userId) return;
  const txRef = getShopDoc(userId, 'khata_transactions', tx.id);
  const data = cleanData({
    ...tx,
    syncedAt: serverTimestamp(),
  });
  await setDoc(txRef, data, { merge: true });
}

export async function fetchKhataTxFromCloud(userId: string): Promise<KhataTransaction[]> {
  if (!userId) return [];
  const colRef = getShopCollection(userId, 'khata_transactions');
  const snapshot = await getDocs(colRef);
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      ...data,
      id: docSnap.id,
      syncStatus: 'synced',
    } as KhataTransaction;
  });
}

// ==================== PAYMENTS ====================

export async function savePaymentToCloud(userId: string, payment: Payment): Promise<void> {
  if (!userId) return;
  const pmtRef = getShopDoc(userId, 'payments', payment.id);
  const data = cleanData({
    ...payment,
    syncedAt: serverTimestamp(),
  });
  await setDoc(pmtRef, data, { merge: true });
}

export async function fetchPaymentsFromCloud(userId: string): Promise<Payment[]> {
  if (!userId) return [];
  const colRef = getShopCollection(userId, 'payments');
  const snapshot = await getDocs(colRef);
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      ...data,
      id: docSnap.id,
      syncStatus: 'synced',
    } as Payment;
  });
}

// ==================== SETTINGS ====================

export async function saveSettingsToCloud(userId: string, settings: ShopSettings): Promise<void> {
  if (!userId) return;
  const settingsRef = getShopDoc(userId, 'settings', 'profile');
  const data = cleanData({
    ...settings,
    syncedAt: serverTimestamp(),
  });
  await setDoc(settingsRef, data, { merge: true });
}

export async function fetchSettingsFromCloud(userId: string): Promise<ShopSettings | null> {
  if (!userId) return null;
  const settingsRef = getShopDoc(userId, 'settings', 'profile');
  const snap = await getDoc(settingsRef);
  if (snap.exists()) {
    return snap.data() as ShopSettings;
  }
  return null;
}

// ==================== SYNC QUEUE EXECUTION ====================

function mapEntityTypeToCollection(entityType: string): string {
  switch (entityType) {
    case 'product':
      return 'products';
    case 'sale':
      return 'sales';
    case 'customer':
      return 'customers';
    case 'khata_transaction':
      return 'khata_transactions';
    case 'payment':
      return 'payments';
    case 'settings':
      return 'settings';
    default:
      return entityType;
  }
}

export async function executeSingleCloudOperation(userId: string, op: SyncQueueItem): Promise<void> {
  if (!userId) return;
  const collectionName = mapEntityTypeToCollection(op.entityType);
  const docId = op.entityType === 'settings' ? 'profile' : op.entityId;
  const docRef = getShopDoc(userId, collectionName, docId);

  if (op.operation === 'delete') {
    await deleteDoc(docRef);
  } else {
    let payload: any = {};
    try {
      payload = typeof op.payload === 'string' ? JSON.parse(op.payload) : op.payload;
    } catch {
      payload = op.payload;
    }

    const cleaned = cleanData({
      ...payload,
      syncedAt: serverTimestamp(),
    });
    await setDoc(docRef, cleaned, { merge: true });
  }
}

export async function executeBatchCloudQueue(
  userId: string,
  items: SyncQueueItem[]
): Promise<{ succeededIds: string[]; failedIds: string[] }> {
  if (!userId || items.length === 0) return { succeededIds: [], failedIds: [] };

  const succeededIds: string[] = [];
  const failedIds: string[] = [];

  // Firestore batches can hold up to 400 operations safely
  const CHUNK_SIZE = 400;
  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    const chunk = items.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);

    for (const item of chunk) {
      const collectionName = mapEntityTypeToCollection(item.entityType);
      const docId = item.entityType === 'settings' ? 'profile' : item.entityId;
      const docRef = getShopDoc(userId, collectionName, docId);

      if (item.operation === 'delete') {
        batch.delete(docRef);
      } else {
        let payload: any = {};
        try {
          payload = typeof item.payload === 'string' ? JSON.parse(item.payload) : item.payload;
        } catch {
          payload = item.payload;
        }
        const cleaned = cleanData({
          ...payload,
          syncedAt: serverTimestamp(),
        });
        batch.set(docRef, cleaned, { merge: true });
      }
    }

    try {
      await batch.commit();
      succeededIds.push(...chunk.map((c) => c.id));
    } catch (err) {
      console.warn('[FirestoreService] Batch commit failed, falling back to individual writes:', err);
      for (const item of chunk) {
        try {
          await executeSingleCloudOperation(userId, item);
          succeededIds.push(item.id);
        } catch (indErr) {
          console.warn(`[FirestoreService] Single item ${item.id} sync failed:`, indErr);
          failedIds.push(item.id);
        }
      }
    }
  }

  return { succeededIds, failedIds };
}
/**
 * Permanently deletes all cloud data associated with the user:
 * - products, sales, customers, khata_transactions, payments, settings
 * - user shop root document
 * Required for Play Store Account Deletion policy compliance.
 */
export async function deleteAllUserCloudData(userId: string): Promise<{ success: boolean; error?: string }> {
  if (!userId) return { success: false, error: 'User ID is required.' };

  const subcollections = ['products', 'sales', 'customers', 'khata_transactions', 'payments', 'settings'];

  try {
    for (const colName of subcollections) {
      const colRef = getShopCollection(userId, colName);
      const snap = await getDocs(colRef);
      if (!snap.empty) {
        // Delete in batches of 400
        const CHUNK_SIZE = 400;
        for (let i = 0; i < snap.docs.length; i += CHUNK_SIZE) {
          const chunk = snap.docs.slice(i, i + CHUNK_SIZE);
          const batch = writeBatch(db);
          for (const d of chunk) {
            batch.delete(d.ref);
          }
          await batch.commit();
        }
      }
    }

    // Delete shop profile document itself
    const shopRootRef = doc(db, 'shops', userId);
    await deleteDoc(shopRootRef);

    // Recursively delete all Firebase Storage files under shops/{userId}/ (if storage is provisioned)
    try {
      const userStorageRoot = ref(storage, `shops/${userId}`);
      await deleteStorageFolderRecursively(userStorageRoot);
    } catch (storageErr: any) {
      if (
        storageErr?.code === 'storage/bucket-not-found' ||
        storageErr?.code === 'storage/project-not-found'
      ) {
        console.log('[FirestoreService] Firebase Storage bucket not configured on project; skipped.');
      } else {
        console.error('[FirestoreService] Firebase Storage clean-up failed:', storageErr);
        return {
          success: false,
          error:
            storageErr?.message ||
            'Failed to delete Firebase Storage files. Account was not deleted so you can retry.',
        };
      }
    }

    return { success: true };
  } catch (err: any) {
    console.error('[FirestoreService] deleteAllUserCloudData error:', err);
    return { success: false, error: err?.message || 'Failed to delete cloud documents.' };
  }
}

/**
 * Recursively deletes all files and subfolders under a Firebase Storage reference.
 */
async function deleteStorageFolderRecursively(folderRef: any): Promise<void> {
  try {
    const listResult = await listAll(folderRef);
    const filePromises = listResult.items.map((item) => deleteObject(item));
    const folderPromises = listResult.prefixes.map((prefix) => deleteStorageFolderRecursively(prefix));
    await Promise.all([...filePromises, ...folderPromises]);
  } catch (err: any) {
    // Empty / missing folder or unconfigured storage bucket is fine — nothing to delete.
    if (
      err?.code === 'storage/object-not-found' ||
      err?.code === 'storage/not-found' ||
      err?.code === 'storage/bucket-not-found' ||
      err?.code === 'storage/project-not-found'
    ) {
      return;
    }
    console.error('[FirestoreService] Firebase Storage folder delete failed:', err?.message || err);
    throw err;
  }
}

