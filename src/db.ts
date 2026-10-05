export type TemplateSlotId =
  | 'kyc_requisition'
  | 'cdr_caf_sdr'
  | 'imei_searching'
  | 'ipdr_subscriber'
  | 'google_notice';

export interface CaseRecord {
  id: string;
  caseTitle: string;
  caseReference: string;
  caseGist: string;
  ioName: string;
  createdAt: number;
  updatedAt: number;
}

export interface MasterTemplateRecord {
  slotId: TemplateSlotId;
  templateName: string;
  fileName: string;
  fileSize: number;
  fileBlob: Blob;
  uploadedAt: number;
}

export interface RecentRequisitionRecord {
  id: string;
  moduleTitle: string;
  slotId: TemplateSlotId;
  filename: string;
  caseReference: string;
  targetSubject: string;
  generatedAt: number;
  fileBlob?: Blob;
}

export interface GeneratorSlotMeta {
  slotId: TemplateSlotId;
  indexNumber: string;
  title: string;
  shortDesc: string;
  expectedPlaceholders: string[];
}

export const GENERATOR_MODULES: GeneratorSlotMeta[] = [
  {
    slotId: 'kyc_requisition',
    indexNumber: '#1',
    title: 'KYC REQUISITION',
    shortDesc: '',
    expectedPlaceholders: ['Case Reference', 'IO Name', 'Memo No.', 'Date', 'Bank Name', 'Account Number', 'Statement From Date'],
  },
  {
    slotId: 'cdr_caf_sdr',
    indexNumber: '#2',
    title: 'CDR / CAF / SDR',
    shortDesc: '',
    expectedPlaceholders: ['Case Reference', 'Case Gist', 'IO Name', 'Requisition Type', 'Mobile Number', 'From Date', 'To Date'],
  },
  {
    slotId: 'imei_searching',
    indexNumber: '#3',
    title: 'IMEI SEARCHING',
    shortDesc: '',
    expectedPlaceholders: ['Case Reference', 'IO Name', 'IMEI Number', 'From Date', 'To Date'],
  },
  {
    slotId: 'ipdr_subscriber',
    indexNumber: '#4',
    title: 'IPDR / IP SUBSCRIBER DETAILS',
    shortDesc: '',
    expectedPlaceholders: ['Case Reference', 'IO Name', 'DATA_REQUIRED'],
  },
  {
    slotId: 'google_notice',
    indexNumber: '#5',
    title: 'GOOGLE NOTICE',
    shortDesc: '',
    expectedPlaceholders: ['Case Reference', 'Case Gist', 'IO Name', 'Email / Gmail ID', 'Date'],
  },
];

const DB_NAME = 'SainthiaGeneratorWorkspaceDB';
const DB_VERSION = 2; // Upgraded for recent_requisitions store
const STORE_CASES = 'case_vault';
const STORE_TEMPLATES = 'master_templates';
const STORE_RECENT = 'recent_requisitions';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_CASES)) {
        const caseStore = db.createObjectStore(STORE_CASES, { keyPath: 'id' });
        caseStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_TEMPLATES)) {
        db.createObjectStore(STORE_TEMPLATES, { keyPath: 'slotId' });
      }
      if (!db.objectStoreNames.contains(STORE_RECENT)) {
        const recentStore = db.createObjectStore(STORE_RECENT, { keyPath: 'id' });
        recentStore.createIndex('generatedAt', 'generatedAt', { unique: false });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error || new Error('Failed to initialize local IndexedDB'));
    };
  });
}

export async function getAllCases(): Promise<CaseRecord[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CASES, 'readonly');
    const store = tx.objectStore(STORE_CASES);
    const request = store.getAll();

    request.onsuccess = () => {
      const result = (request.result as CaseRecord[]) || [];
      result.sort((a, b) => b.updatedAt - a.updatedAt);
      resolve(result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function saveCaseRecord(record: CaseRecord): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CASES, 'readwrite');
    const store = tx.objectStore(STORE_CASES);
    const request = store.put(record);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteCaseRecord(id: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CASES, 'readwrite');
    const store = tx.objectStore(STORE_CASES);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getAllMasterTemplates(): Promise<Record<TemplateSlotId, MasterTemplateRecord | undefined>> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_TEMPLATES, 'readonly');
    const store = tx.objectStore(STORE_TEMPLATES);
    const request = store.getAll();

    request.onsuccess = () => {
      const list = (request.result as MasterTemplateRecord[]) || [];
      const map: Record<TemplateSlotId, MasterTemplateRecord | undefined> = {
        kyc_requisition: undefined,
        cdr_caf_sdr: undefined,
        imei_searching: undefined,
        ipdr_subscriber: undefined,
        google_notice: undefined,
      };
      for (const item of list) {
        map[item.slotId] = item;
      }
      resolve(map);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function saveMasterTemplate(record: MasterTemplateRecord): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_TEMPLATES, 'readwrite');
    const store = tx.objectStore(STORE_TEMPLATES);
    const request = store.put(record);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function removeMasterTemplate(slotId: TemplateSlotId): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_TEMPLATES, 'readwrite');
    const store = tx.objectStore(STORE_TEMPLATES);
    const request = store.delete(slotId);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getAllRecentRequisitions(): Promise<RecentRequisitionRecord[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_RECENT, 'readonly');
    const store = tx.objectStore(STORE_RECENT);
    const request = store.getAll();

    request.onsuccess = () => {
      const result = (request.result as RecentRequisitionRecord[]) || [];
      result.sort((a, b) => b.generatedAt - a.generatedAt);
      resolve(result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function saveRecentRequisition(record: RecentRequisitionRecord): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_RECENT, 'readwrite');
    const store = tx.objectStore(STORE_RECENT);
    const request = store.put(record);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteRecentRequisition(id: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_RECENT, 'readwrite');
    const store = tx.objectStore(STORE_RECENT);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function clearRecentRequisitions(): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_RECENT, 'readwrite');
    const store = tx.objectStore(STORE_RECENT);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function checkIndexedDBHealth(): Promise<boolean> {
  try {
    const db = await openDatabase();
    db.close();
    return true;
  } catch {
    return false;
  }
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatTimestamp(ts: number): string {
  try {
    const d = new Date(ts);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year}, ${hours}:${minutes}`;
  } catch {
    return new Date(ts).toLocaleDateString();
  }
}

/**
 * Converts standard date input strings (YYYY-MM-DD or other formats) to DD/MM/YYYY.
 * E.g. "2026-10-05" -> "05/10/2026"
 */
export function formatDateToDDMMYYYY(val: string): string {
  if (!val) return '';
  const trimmed = val.trim();
  // If YYYY-MM-DD
  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const year = isoMatch[1];
    const month = isoMatch[2].padStart(2, '0');
    const day = isoMatch[3].padStart(2, '0');
    return `${day}/${month}/${year}`;
  }
  // If already DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${day}/${month}/${year}`;
  }
  return trimmed;
}
