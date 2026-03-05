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

  // 감사 로그 (업로드 성공 후, 실패해도 무시)
  writeAuditLog('file_upload', null, `${title} (${weekKey}) - ${file.name}`);
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

/** localStorage에서 특정 영업점 설정 삭제 */
function removeLocalConfig(storeCode: string) {
  const configs = getLocalConfigs();
  delete configs[storeCode];
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(configs));
}

/**
 * 영업점별 조코드 설정 불러오기
 * 1) Supabase에서 조회 시도
 * 2) Supabase 성공 + 데이터 없음 → localStorage 캐시도 삭제 → null 반환
 * 3) Supabase 실패(네트워크 오류) → localStorage 폴백
 * 4) 둘 다 없으면 null (= 기본값 사용)
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
      // Supabase 정상 응답이지만 데이터 없음 → 캐시 삭제
      removeLocalConfig(storeCode);
      return null;
    }
  } catch (e) {
    console.warn('Supabase category config fetch failed, using localStorage:', e);
    // 네트워크 실패 시에만 localStorage 폴백
    const local = getLocalConfigs();
    return local[storeCode] || null;
  }

  return null;
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
    } else {
      // 감사 로그 (저장 성공 후, 실패해도 무시)
      const categoryNames = categories.join(', ');
      writeAuditLog('config_save', storeCode, `조코드: ${categoryNames}`);
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

/** localStorage에서 특정 영업점 파트 설정 삭제 */
function removeLocalPartConfig(storeCode: string) {
  const configs = getLocalPartConfigs();
  delete configs[storeCode];
  localStorage.setItem(PART_CONFIG_KEY, JSON.stringify(configs));
}

/**
 * 영업점별 파트 설정 불러오기
 * 1) Supabase에서 조회 시도
 * 2) Supabase 성공 + 데이터 없음 → localStorage 캐시도 삭제 → null 반환
 * 3) Supabase 실패(네트워크 오류) → localStorage 폴백
 * 4) 둘 다 없으면 null (= 기본값 사용)
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
        // 레거시: string[] → 파트 미설정으로 간주, 캐시 삭제
      }
      // Supabase 정상 응답이지만 데이터 없음 → 캐시 삭제
      removeLocalPartConfig(storeCode);
      return null;
    }
  } catch (e) {
    console.warn('Supabase part config fetch failed, using localStorage:', e);
    // 네트워크 실패 시에만 localStorage 폴백
    const local = getLocalPartConfigs();
    return local[storeCode] || null;
  }

  return null;
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
    } else {
      // 감사 로그 (저장 성공 후, 실패해도 무시)
      const partNames = parts.map(p => p.name).join(', ');
      writeAuditLog('config_save', storeCode, `파트: ${partNames}`);
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

// ============================
// Audit Log (작업 기록)
// ============================

const AUDIT_TABLE = 'audit_log';

/** IP 주소 가져오기 (캐시) */
let cachedIp: string | null = null;
async function getClientIp(): Promise<string> {
  if (cachedIp) return cachedIp;
  try {
    const res = await fetch('https://api.ipify.org?format=json');
    const data = await res.json();
    cachedIp = data.ip;
    return data.ip;
  } catch {
    return 'unknown';
  }
}

/**
 * 에러 로그 중복 방지 throttle (5분)
 * key = action + detail 해시 → 5분 내 같은 에러 재기록 방지
 */
const recentErrorKeys = new Map<string, number>();
const ERROR_THROTTLE_MS = 5 * 60 * 1000; // 5분

function isErrorThrottled(action: string, detail?: string): boolean {
  const key = `${action}::${detail || ''}`;
  const now = Date.now();
  const lastTime = recentErrorKeys.get(key);
  if (lastTime && now - lastTime < ERROR_THROTTLE_MS) {
    return true; // 아직 5분 안 지남 → 스킵
  }
  recentErrorKeys.set(key, now);
  // 오래된 엔트리 정리 (100개 초과 시)
  if (recentErrorKeys.size > 100) {
    for (const [k, t] of recentErrorKeys) {
      if (now - t > ERROR_THROTTLE_MS) recentErrorKeys.delete(k);
    }
  }
  return false;
}

/**
 * 감사 로그 기록
 * @param action - 'file_upload' | 'config_save' | 'error' | 'error_global'
 * @param storeCode - 영업점 코드
 * @param detail - 추가 정보 (파일명, 파트명, 에러 메시지 등)
 */
export async function writeAuditLog(
  action: string,
  storeCode: string | null,
  detail?: string
): Promise<void> {
  try {
    const ip = await getClientIp();
    const userAgent = navigator.userAgent;

    await fetch(`${SUPABASE_REST}/${AUDIT_TABLE}`, {
      method: 'POST',
      headers: {
        'apikey': publicAnonKey,
        'Authorization': `Bearer ${publicAnonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action,
        store_code: storeCode,
        detail,
        ip_address: ip,
        user_agent: userAgent,
      }),
    });
  } catch (e) {
    console.warn('Audit log write failed:', e);
  }
}

/**
 * 에러 전용 로그 (5분 중복 방지 throttle 적용)
 * @param source - 에러 발생 위치 (예: 'cloud_fetch', 'upload', 'global_error')
 * @param error - Error 객체 또는 메시지
 * @param storeCode - 영업점 코드 (있으면)
 */
export async function writeErrorLog(
  source: string,
  error: unknown,
  storeCode?: string | null
): Promise<void> {
  const message = error instanceof Error
    ? `${error.name}: ${error.message}`
    : String(error);
  const detail = `[${source}] ${message}`.slice(0, 1000); // 최대 1000자

  // throttle 체크
  if (isErrorThrottled('error', detail)) {
    return;
  }

  await writeAuditLog('error', storeCode || null, detail);
}

/**
 * 전역 에러 핸들러 설치 (앱 초기화 시 1회 호출)
 * - window.onerror: 동기 에러
 * - window.onunhandledrejection: 비동기 Promise 에러
 */
export function installGlobalErrorLogger(): void {
  window.onerror = (message, source, lineno, colno, error) => {
    const detail = `${message} at ${source}:${lineno}:${colno}`;
    writeErrorLog('global_onerror', error || detail);
  };

  window.onunhandledrejection = (event: PromiseRejectionEvent) => {
    writeErrorLog('global_unhandled_promise', event.reason);
  };
}