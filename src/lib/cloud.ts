import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { CATEGORIES } from './constants';

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/server`;

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
// Shelf Location Info (서가위치 조회)
// ============================

export interface ShelfLocation {
  location: string;  // e.g., "[J관 2] 평대"
  category: string;  // e.g., "한국소설 베스트 > (1) 베스트하단 MD"
}

export interface ShelfResult {
  stock: string | null;    // e.g., "246부"
  locations: ShelfLocation[];
}

export type ShelfInfoMap = Record<string, ShelfResult | null>;

// 메모리 캐시: 세션 동안 유지 (같은 영업점+ISBN 재조회 방지)
const shelfCache = new Map<string, ShelfResult | null>();

// 중복 호출 방지 — ISBN별 개별 추적
const shelfFetchingIsbns = new Set<string>();

/** CORS 프록시를 통해 단일 URL fetch (Supabase 자체 프록시 사용) */
async function fetchViaProxy(targetUrl: string): Promise<string | null> {
  const proxyUrl = `${BASE_URL}/kiosk-proxy?url=${encodeURIComponent(targetUrl)}`;

  try {
    console.log(`[shelf]   → Supabase Proxy 시도 중...`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15초 타임아웃
    
    const res = await fetch(proxyUrl, {
      headers: { 
        'Authorization': `Bearer ${publicAnonKey}` 
      },
      signal: controller.signal 
    });
    clearTimeout(timeoutId);

    console.log(`[shelf]   → Supabase Proxy 응답: ${res.status} ${res.statusText}`);
    if (!res.ok) return null;

    const text = await res.text();
    if (text && text.length > 100) {
      console.log(`[shelf]   → Supabase Proxy 성공: ${text.length}자`);
      return text;
    }
    console.log(`[shelf]   → Supabase Proxy 응답 너무 짧음: ${text.length}자`);
    return null;
  } catch (err: any) {
    const reason = err?.name === 'AbortError' ? '타임아웃(15초)' : (err?.message || String(err));
    console.warn(`[shelf]   → Supabase Proxy 실패: ${reason}`);
    return null;
  }
}

/**
 * 키오스크 HTML에서 서가 정보 파싱
 */
function parseShelfHtml(html: string): ShelfResult {
  const out: ShelfLocation[] = [];
  let stock: string | null = null;
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');

    // 1차: div.p_stock 내 dt 요소들로 서가 정보 추출
    const stockDiv = doc.querySelector('.p_stock');
    if (stockDiv) {
      const dtElements = stockDiv.querySelectorAll('dt');
      console.log(`[shelf] p_stock 내 dt 요소: ${dtElements.length}개`);

      dtElements.forEach((dt, i) => {
        if (out.length >= 2) return; // 최대 2개

        // <strong> → "[J관 2]" 같은 위치 코드
        const strong = dt.querySelector('strong');
        const bracket = strong ? (strong.textContent || '').replace(/\s+/g, ' ').trim() : '';

        // <span> → "한국소설 베스트" " > (1) 베스트하단 MD"
        const span = dt.querySelector('span');
        const category = span ? (span.textContent || '').replace(/\s+/g, ' ').trim() : '';

        let shelfType = '';
        dt.childNodes.forEach(node => {
          if (node.nodeType === Node.TEXT_NODE) {
            const t = (node.textContent || '').trim();
            if (t && t !== bracket && t !== category) {
              shelfType += (shelfType ? ' ' : '') + t;
            }
          }
        });

        if (!bracket && !shelfType && !category) return; // 빈 dt 스킵

        const location = [bracket, shelfType].filter(Boolean).join(' ').trim();
        console.log(`[shelf] dt[${i}]: location="${location}", category="${category}"`);
        out.push({ location, category });
      });

      // 재고 정보 추출
      const allStrongs = stockDiv.querySelectorAll('strong');
      allStrongs.forEach((s) => {
        if (stock) return;
        const txt = (s.textContent || '').replace(/\s+/g, ' ').trim();
        const m = txt.match(/재고\s*[:\s]\s*(\d[\d,]*)\s*부/);
        if (m) {
          stock = m[1].replace(/,/g, '');
          console.log(`[shelf] 재고 발견: "${stock}부" (원문: "${txt}")`);
        }
      });
      // 폴백: p_stock 전체 텍스트에서 재고 패턴 탐색
      if (!stock) {
        const fullText = (stockDiv.textContent || '').replace(/\s+/g, ' ').trim();
        const fm = fullText.match(/재고\s*[:\s]\s*(\d[\d,]*)\s*부/);
        if (fm) {
          stock = fm[1].replace(/,/g, '');
          console.log(`[shelf] 재고 폴백: "${stock}부"`);
        }
      }
    }

    // 2차 폴백: p_stock이 없으면 전체 텍스트에서 "도서위치:" 키워드 탐색
    if (out.length === 0) {
      doc.querySelectorAll('script, style, link, meta, noscript').forEach(el => el.remove());
      const text = (doc.body?.textContent || '').replace(/\s+/g, ' ').trim();
      const marker = '도서위치:';
      const idx = text.indexOf(marker);
      if (idx >= 0) {
        const afterMarker = text.substring(idx + marker.length).trim();
        console.log('[shelf] 폴백 - 도서위치 원문:', afterMarker.slice(0, 120));
        if (!/^ISBN\s*\d/.test(afterMarker)) {
          // [X관 N] 패턴 탐색
          const bracketRegex = /\[([^\]]+)\]\s*/g;
          let m;
          while ((m = bracketRegex.exec(afterMarker)) !== null && out.length < 2) {
            const b = m[1].trim();
            if (/^(닫기|확인|검색|취소|이전|다음|홈|메뉴|로그인)$/.test(b)) continue;
            const restStart = m.index + m[0].length;
            const nextB = afterMarker.indexOf('[', restStart);
            const restEnd = nextB > 0 ? nextB : Math.min(restStart + 80, afterMarker.length);
            const rest = afterMarker.substring(restStart, restEnd).trim();
            out.push({ location: `[${b}] ${rest.split('>')[0]?.trim() || ''}`.trim(), category: rest });
          }
          if (out.length === 0 && afterMarker.length > 2) {
            out.push({ location: afterMarker.slice(0, 60), category: '' });
          }
        }
      } else {
        console.log('[shelf] "도서위치:" 키워드 없음, p_stock도 없음');
      }
    }

    console.log('[shelf] 최종 파싱 결과:', out);
  } catch (e) {
    console.warn('[shelf] parseShelfHtml error:', e);
  }
  return { stock, locations: out };
}

/**
 * 서가위치 정보 조회
 */
export async function fetchShelfInfo(
  storeCode: string,
  isbns: string[]
): Promise<ShelfInfoMap> {
  const result: ShelfInfoMap = {};
  const uncached: string[] = [];

  for (const isbn of isbns) {
    const cacheKey = `${storeCode}:${isbn}`;
    if (shelfCache.has(cacheKey)) {
      result[isbn] = shelfCache.get(cacheKey)!;
    } else {
      uncached.push(isbn);
    }
  }

  if (uncached.length === 0) return result;

  // 중복 호출 방지
  const alreadyFetching = uncached.filter(isbn => shelfFetchingIsbns.has(isbn));
  if (alreadyFetching.length > 0) {
    console.log('[shelf] 이미 조회 중 → 스킵:', alreadyFetching);
    return result;
  }
  uncached.forEach(isbn => shelfFetchingIsbns.add(isbn));

  console.log(`[shelf] 서가 조회 시작: storeCode=${storeCode}, ${uncached.length}건`);

  try {
    // 4씩 병렬 처리
    for (let i = 0; i < uncached.length; i += 4) {
      const chunk = uncached.slice(i, i + 4);
      console.log(`[shelf] 청크 ${Math.floor(i/4)+1}: ${chunk.map(x => x.replace(/[-\s]/g,'')).join(', ')}`);
      const results = await Promise.allSettled(chunk.map(async (isbn) => {
        const clean = isbn.replace(/[-\s]/g, '');
        const kioskUrl = `https://kiosk.kyobobook.co.kr/bookInfoInk?site=${storeCode}&barcode=${clean}&ejkGb=KOR`;
        console.log(`[shelf] ${clean}: fetch 시작`);
        try {
          const html = await fetchViaProxy(kioskUrl);
          if (!html) {
            console.log(`[shelf] ${clean}: HTML 없음 (모든 프록시 실패)`);
            result[isbn] = null;
            shelfCache.set(`${storeCode}:${isbn}`, null);
            return;
          }
          console.log(`[shelf] ${clean}: HTML ${html.length}자 수신, 파싱 시작`);
          const parsed = parseShelfHtml(html);
          const val = parsed.locations.length > 0 ? parsed : null;
          result[isbn] = val;
          shelfCache.set(`${storeCode}:${isbn}`, val);
          console.log(`[shelf] ${clean}: 완료 → ${val ? val.locations.map(v=>v.location).join(' / ') : '서가 없음'}`);
        } catch (e) {
          console.error(`[shelf] ${clean}: 예외`, e);
          result[isbn] = null;
          shelfCache.set(`${storeCode}:${isbn}`, null);
        } finally {
          shelfFetchingIsbns.delete(isbn);
        }
      }));
      console.log(`[shelf] 청크 ${Math.floor(i/4)+1} 완료:`, results.map(r => r.status));
    }
  } finally {
    uncached.forEach(isbn => shelfFetchingIsbns.delete(isbn));
  }

  return result;
}

/** 영업점 변경 시 서가 캐시 초기화 */
export function clearShelfCache(): void {
  shelfCache.clear();
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

// 브라우저 확장/번역 등 외부 DOM 조작으로 발생하는 무해한 에러 필터
const IGNORED_ERRORS = [
  'removeChild',
  'insertBefore',
  'The node to be removed is not a child',
  'NotFoundError',
];

function isIgnoredError(msg: string): boolean {
  return IGNORED_ERRORS.some(keyword => msg.includes(keyword));
}

export function installGlobalErrorLogger(): void {
  // ── DOM API 패치: 브라우저 확장/번역이 건드린 노드로 인한 React 크래시 근본 차단 ──
  patchDomForExtensions();

  window.onerror = (message, source, lineno, colno, error) => {
    const msg = String(message);
    if (isIgnoredError(msg)) return;
    const detail = `${msg} at ${source}:${lineno}:${colno}`;
    writeErrorLog('global_onerror', error || detail);
  };

  window.onunhandledrejection = (event: PromiseRejectionEvent) => {
    const msg = String(event.reason);
    if (isIgnoredError(msg)) return;
    writeErrorLog('global_unhandled_promise', event.reason);
  };
}

/**
 * DOM API 패치
 */
function patchDomForExtensions() {
  const originalRemoveChild = Node.prototype.removeChild;
  const originalInsertBefore = Node.prototype.insertBefore;

  Node.prototype.removeChild = function(child: Node) {
    try {
      return originalRemoveChild.call(this, child);
    } catch (e) {
      console.warn('DOM API patch: removeChild failed, ignoring:', e);
      return child;
    }
  };

  Node.prototype.insertBefore = function(newNode: Node, referenceNode: Node | null) {
    try {
      return originalInsertBefore.call(this, newNode, referenceNode);
    } catch (e) {
      console.warn('DOM API patch: insertBefore failed, ignoring:', e);
      return newNode;
    }
  };
}
