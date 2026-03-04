import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { CATEGORIES } from './constants';

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-22196a99`;

export interface CloudFileInfo {
  exists: boolean;
  weekKey?: string;
  title?: string;
  filename?: string;
  uploadedAt?: string;
  url?: string;
  fileHash?: string;
  error?: string;
}

export interface CloudFilesResponse {
  thisWeek: CloudFileInfo;
  lastWeek: CloudFileInfo;
}

/**
 * Fetch the 2 most recent files (auto-sorted by weekKey)
 */
export async function fetchCloudFiles(): Promise<CloudFilesResponse> {
  const res = await fetch(`${BASE_URL}/files`, {
    headers: { Authorization: `Bearer ${publicAnonKey}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch cloud files: ${res.status} ${text}`);
  }
  return res.json();
}

/**
 * Compute SHA-256 hash of a File (browser Web Crypto API)
 * ~70KB file → < 1ms
 */
export async function computeFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Upload an excel file with auto-detected weekKey
 */
export async function uploadToCloud(
  file: File,
  weekKey: string,
  title: string,
  fileHash?: string
): Promise<void> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('weekKey', weekKey);
  formData.append('title', title);
  if (fileHash) formData.append('fileHash', fileHash);

  const res = await fetch(`${BASE_URL}/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${publicAnonKey}` },
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload failed: ${res.status} ${text}`);
  }
}

/**
 * Download a file from signed URL and return as ArrayBuffer (binary-safe)
 */
export async function downloadFileAsBuffer(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  return res.arrayBuffer();
}

// ============================
// Store Category Config (영업점별 조코드 설정)
// Supabase REST API + localStorage fallback
// ============================

const SUPABASE_REST = `https://${projectId}.supabase.co/rest/v1`;
const CATEGORY_TABLE = 'store_category_config';
const LOCAL_STORAGE_KEY = 'store_category_config';

export interface StoreCategoryConfig {
  store_code: string;
  categories: string[];
  updated_at?: string;
}

/** localStorage에서 모든 설정 읽기 */
function getLocalConfigs(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** localStorage에 설정 저장 */
function setLocalConfig(storeCode: string, categories: string[]) {
  const configs = getLocalConfigs();
  configs[storeCode] = categories;
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(configs));
}

/**
 * 영업점별 조코드 설정 불러오기
 * 1) Supabase에서 조회 시도
 * 2) 실패 시 localStorage 폴백
 * 3) 둘 다 없으면 null (= 기본값 사용)
 */
export async function fetchStoreCategoryConfig(storeCode: string): Promise<string[] | null> {
  // Try Supabase first
  try {
    const res = await fetch(
      `${SUPABASE_REST}/${CATEGORY_TABLE}?store_code=eq.${storeCode}&select=categories`,
      {
        headers: {
          'apikey': publicAnonKey,
          'Authorization': `Bearer ${publicAnonKey}`,
        },
      }
    );
    if (res.ok) {
      const rows = await res.json();
      if (rows.length > 0 && Array.isArray(rows[0].categories)) {
        // Supabase 성공 → localStorage에도 캐싱
        setLocalConfig(storeCode, rows[0].categories);
        return rows[0].categories;
      }
    }
  } catch (e) {
    console.warn('Supabase category config fetch failed, using localStorage:', e);
  }

  // Fallback: localStorage
  const local = getLocalConfigs();
  return local[storeCode] || null;
}

/**
 * 영업점별 조코드 설정 저장
 * 1) Supabase UPSERT
 * 2) localStorage에도 저장 (캐시)
 */
export async function saveStoreCategoryConfig(storeCode: string, categories: string[]): Promise<void> {
  // Always save to localStorage
  setLocalConfig(storeCode, categories);

  // Try Supabase upsert
  try {
    const res = await fetch(`${SUPABASE_REST}/${CATEGORY_TABLE}`, {
      method: 'POST',
      headers: {
        'apikey': publicAnonKey,
        'Authorization': `Bearer ${publicAnonKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        store_code: storeCode,
        categories,
        updated_at: new Date().toISOString(),
      }),
    });
    if (!res.ok) {
      console.warn('Supabase category config save failed:', res.status, await res.text());
    }
  } catch (e) {
    console.warn('Supabase category config save failed:', e);
  }
}

// ============================
// Store Part Config (영업점별 파트 + 조코드 설정)
// Supabase REST API + localStorage fallback
// ============================

const PART_CONFIG_KEY = 'store_part_config';

/** 파트 내 조코드 항목 */
export interface PartCategoryItem {
  code: string;
  rank: number;
}

/** 파트 설정 */
export interface PartConfig {
  id: string;
  name: string;
  categories: PartCategoryItem[];
}

/** localStorage에서 파트 설정 읽기 */
function getLocalPartConfigs(): Record<string, PartConfig[]> {
  try {
    const raw = localStorage.getItem(PART_CONFIG_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** localStorage에 파트 설정 저장 */
function setLocalPartConfig(storeCode: string, parts: PartConfig[]) {
  const configs = getLocalPartConfigs();
  configs[storeCode] = parts;
  localStorage.setItem(PART_CONFIG_KEY, JSON.stringify(configs));
}

/**
 * 영업점별 파트 설정 불러오기
 * 1) Supabase에서 조회 시도
 * 2) 실패 시 localStorage 폴백
 * 3) 둘 다 없으면 null (= 기본값 사용)
 */
export async function fetchStorePartConfig(storeCode: string): Promise<PartConfig[] | null> {
  // Try Supabase first — 기존 categories JSONB 컬럼에 파트 배열을 저장
  try {
    const res = await fetch(
      `${SUPABASE_REST}/${CATEGORY_TABLE}?store_code=eq.${storeCode}&select=categories`,
      {
        headers: {
          'apikey': publicAnonKey,
          'Authorization': `Bearer ${publicAnonKey}`,
        },
      }
    );
    if (res.ok) {
      const rows = await res.json();
      if (rows.length > 0 && rows[0].categories != null) {
        const data = rows[0].categories;
        // 신규 파트 형식: { parts: PartConfig[] }
        if (typeof data === 'object' && !Array.isArray(data) && Array.isArray(data.parts)) {
          setLocalPartConfig(storeCode, data.parts);
          return data.parts;
        }
        // 레거시: string[] → 무시 (파트 미설정)
      }
    }
  } catch (e) {
    console.warn('Supabase part config fetch failed, using localStorage:', e);
  }

  // Fallback: localStorage
  const local = getLocalPartConfigs();
  return local[storeCode] || null;
}

/**
 * 영업점별 파트 설정 저장
 * 기존 categories JSONB 컬럼에 { parts: PartConfig[] } 형태로 저장
 * 1) Supabase UPSERT
 * 2) localStorage에도 저장 (캐시)
 */
export async function saveStorePartConfig(storeCode: string, parts: PartConfig[]): Promise<void> {
  // Always save to localStorage
  setLocalPartConfig(storeCode, parts);

  // Try Supabase upsert — categories 컬럼에 래핑하여 저장
  try {
    const res = await fetch(`${SUPABASE_REST}/${CATEGORY_TABLE}`, {
      method: 'POST',
      headers: {
        'apikey': publicAnonKey,
        'Authorization': `Bearer ${publicAnonKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        store_code: storeCode,
        categories: { parts },
        updated_at: new Date().toISOString(),
      }),
    });
    if (!res.ok) {
      console.warn('Supabase part config save failed:', res.status, await res.text());
    }
  } catch (e) {
    console.warn('Supabase part config save failed:', e);
  }
}

/** 기본 파트 생성: "기본" 파트에 전체 조코드 포함 */
export function getDefaultParts(): PartConfig[] {
  return [{
    id: 'default-basic',
    name: '기본',
    categories: CATEGORIES.map(code => ({ code, rank: 20 })),
  }];
}

/**
 * 특정 영업점의 파트 설정을 기본값으로 초기화 (DB + localStorage)
 */
export async function resetStorePartConfig(storeCode: string): Promise<void> {
  const defaultParts = getDefaultParts();
  await saveStorePartConfig(storeCode, defaultParts);
}