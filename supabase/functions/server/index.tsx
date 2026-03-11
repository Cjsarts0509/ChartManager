import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import * as kv from "./kv_store.tsx";

const app = new Hono();
const BUCKET_NAME = "make-22196a99-excel";
const PREFIX = "/make-server-22196a99";

// Supabase client (service role for storage operations)
const supabase = () =>
  createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

// Idempotent bucket creation on startup
(async () => {
  try {
    const sb = supabase();
    const { data: buckets } = await sb.storage.listBuckets();
    // deno-lint-ignore no-explicit-any
    const bucketExists = buckets?.some((b: any) => b.name === BUCKET_NAME);
    if (!bucketExists) {
      await sb.storage.createBucket(BUCKET_NAME, { public: false });
      console.log(`Bucket "${BUCKET_NAME}" created.`);
    } else {
      console.log(`Bucket "${BUCKET_NAME}" already exists.`);
    }
  } catch (e) {
    console.log("Bucket creation error:", e);
  }
})();

// Enable logger
app.use("*", logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  })
);

// Health check — version 3 = shelf-info 라우트 포함 확인용
app.get(`${PREFIX}/health`, (c) => {
  return c.json({ status: "ok", v: 3 });
});

// ============================================================
// POST /upload
// ============================================================
app.post(`${PREFIX}/upload`, async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get("file") as File | null;
    const weekKey = formData.get("weekKey") as string | null;
    const title = formData.get("title") as string | null;
    const fileHash = formData.get("fileHash") as string | null;

    if (!file) {
      return c.json({ error: "No file provided" }, 400);
    }
    if (!weekKey || !/^\d{4}-\d{2}-\d{2}$/.test(weekKey)) {
      return c.json({ error: `Invalid weekKey: "${weekKey}". Expected format: "YYYY-MM-WW" (e.g. "2026-02-02")` }, 400);
    }

    const sb = supabase();
    const storagePath = `weeks/${weekKey}/data.xlsx`;

    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const { error: uploadError } = await sb.storage
      .from(BUCKET_NAME)
      .upload(storagePath, uint8Array, {
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        upsert: true,
      });

    if (uploadError) {
      console.log(`Upload error for ${weekKey}:`, uploadError);
      return c.json({ error: `Upload failed: ${uploadError.message}` }, 500);
    }

    await kv.set(`excel-week-${weekKey}`, {
      weekKey,
      title: title || "",
      filename: file.name,
      uploadedAt: new Date().toISOString(),
      storagePath,
      fileHash,
    });

    console.log(`File uploaded: weekKey=${weekKey}, file=${file.name}`);
    return c.json({
      success: true,
      weekKey,
      filename: file.name,
      title: title || "",
      uploadedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.log("Upload handler error:", e);
    return c.json({ error: `Server error during upload: ${e}` }, 500);
  }
});

// ============================================================
// GET /files
// ============================================================
app.get(`${PREFIX}/files`, async (c) => {
  try {
    const sb = supabase();
    const allEntries = await kv.getByPrefix("excel-week-");

    if (!allEntries || allEntries.length === 0) {
      return c.json({
        thisWeek: { exists: false },
        lastWeek: { exists: false },
      });
    }

    // deno-lint-ignore no-explicit-any
    const sorted = allEntries
      .filter((e: Record<string, unknown>) => e && e.weekKey)
      .sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
        String(b.weekKey).localeCompare(String(a.weekKey))
      );

    // deno-lint-ignore no-explicit-any
    const result: Record<string, any> = {};
    const slots = ["thisWeek", "lastWeek"];
    for (let i = 0; i < 2; i++) {
      const entry = sorted[i];
      if (entry) {
        const { data, error } = await sb.storage
          .from(BUCKET_NAME)
          .createSignedUrl(String(entry.storagePath), 3600);

        if (error) {
          console.log(`Signed URL error for ${entry.weekKey}:`, error);
          result[slots[i]] = { exists: false, error: error.message };
        } else {
          result[slots[i]] = {
            exists: true,
            weekKey: entry.weekKey,
            title: entry.title,
            filename: entry.filename,
            uploadedAt: entry.uploadedAt,
            url: data.signedUrl,
            fileHash: entry.fileHash || null,
          };
        }
      } else {
        result[slots[i]] = { exists: false };
      }
    }

    return c.json(result);
  } catch (e) {
    console.log("Files handler error:", e);
    return c.json({ error: `Server error fetching files: ${e}` }, 500);
  }
});

// ============================================================
// DELETE /files/:weekKey
// ============================================================
app.delete(`${PREFIX}/files/:weekKey`, async (c) => {
  try {
    const weekKey = c.req.param("weekKey");
    const sb = supabase();

    const meta = await kv.get(`excel-week-${weekKey}`);
    if (meta) {
      await sb.storage.from(BUCKET_NAME).remove([meta.storagePath]);
      await kv.del(`excel-week-${weekKey}`);
      console.log(`Deleted file for weekKey=${weekKey}`);
    }

    return c.json({ success: true, weekKey });
  } catch (e) {
    console.log("Delete handler error:", e);
    return c.json({ error: `Server error during delete: ${e}` }, 500);
  }
});

// ============================================================
// POST /shelf-info — 서가위치 조회 (kiosk proxy)
// Body: { storeCode: string, isbns: string[], debug?: boolean }
// ============================================================
app.post(`${PREFIX}/shelf-info`, async (c) => {
  try {
    const body = await c.req.json();
    const storeCode = String(body.storeCode || "");
    const rawIsbns = body.isbns;
    const debugMode = Boolean(body.debug);

    if (!storeCode || !Array.isArray(rawIsbns) || rawIsbns.length === 0) {
      return c.json({ error: "storeCode and isbns[] required" }, 400);
    }

    const isbns: string[] = rawIsbns.map(String).slice(0, 50);
    const results: Record<string, unknown> = {};
    const debugArr: unknown[] = [];

    // 5개씩 병렬 처리
    for (let i = 0; i < isbns.length; i += 5) {
      const chunk = isbns.slice(i, i + 5);
      const promises = chunk.map(async (isbn: string) => {
        const clean = isbn.replace(/[-\s]/g, "");
        const kioskUrl =
          "https://kiosk.kyobobook.co.kr/bookInfoInk?site=" +
          storeCode +
          "&barcode=" +
          clean +
          "&ejkGb=KOR";
        try {
          const res = await fetch(kioskUrl, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
              "Accept": "text/html,*/*",
              "Accept-Language": "ko-KR,ko;q=0.9",
            },
          });
          const html = await res.text();
          console.log("[shelf] " + clean + " status=" + String(res.status) + " len=" + String(html.length));
          if (!res.ok) {
            results[isbn] = null;
            if (debugMode) {
              debugArr.push({ isbn, status: res.status, size: html.length, snippet: html.slice(0, 300), parsed: 0 });
            }
            return;
          }
          const parsed = doParseShelf(html);
          results[isbn] = parsed.length > 0 ? parsed : null;
          if (debugMode) {
            debugArr.push({ isbn, status: res.status, size: html.length, snippet: html.slice(0, 500), parsed: parsed.length });
          }
        } catch (fetchErr) {
          console.log("[shelf] " + clean + " err: " + String(fetchErr));
          results[isbn] = null;
          if (debugMode) {
            debugArr.push({ isbn, error: String(fetchErr) });
          }
        }
      });
      await Promise.all(promises);
    }

    if (debugMode) {
      return c.json({ results, debug: debugArr });
    }
    return c.json({ results });
  } catch (handlerErr) {
    console.log("shelf-info error: " + String(handlerErr));
    return c.json({ error: String(handlerErr) }, 500);
  }
});

// ============================================================
// GET /shelf-test — single ISBN diagnostic
// ============================================================
app.get(`${PREFIX}/shelf-test`, async (c) => {
  const site = c.req.query("site") || "01";
  const isbn = c.req.query("isbn") || "9788936434267";
  const kioskUrl =
    "https://kiosk.kyobobook.co.kr/bookInfoInk?site=" + site + "&barcode=" + isbn + "&ejkGb=KOR";
  try {
    const res = await fetch(kioskUrl, {
      headers: { "User-Agent": "Mozilla/5.0", "Accept": "text/html,*/*", "Accept-Language": "ko-KR" },
    });
    const html = await res.text();
    return c.json({
      url: kioskUrl,
      status: res.status,
      htmlSize: html.length,
      htmlSnippet: html.slice(0, 2000),
      parsed: doParseShelf(html),
    });
  } catch (fetchErr) {
    return c.json({ url: kioskUrl, error: String(fetchErr) }, 500);
  }
});

// ============================================================
// Shelf HTML parser (순수 함수, 외부 의존 없음)
// ============================================================
function doParseShelf(html: string): Array<{ location: string; category: string }> {
  const out: Array<{ location: string; category: string }> = [];
  try {
    // strip script/style
    let t = html;
    t = t.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
    t = t.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");

    // convert tags to newlines, strip remaining tags
    t = t.replace(/<br\s*\/?>/gi, "\n");
    t = t.replace(/<\/(?:div|p|td|th|tr|li|dt|dd|span|strong|b|em|h\d)>/gi, "\n");
    t = t.replace(/<[^>]+>/g, " ");
    t = t.replace(/&nbsp;/g, " ");
    t = t.replace(/&amp;/g, "&");
    t = t.replace(/&lt;/g, "<");
    t = t.replace(/&gt;/g, ">");

    const lines: string[] = [];
    const rawLines = t.split("\n");
    for (let li = 0; li < rawLines.length; li++) {
      const trimmed = rawLines[li].replace(/\s+/g, " ").trim();
      if (trimmed.length > 0) {
        lines.push(trimmed);
      }
    }

    // Strategy 1: [bracket] patterns
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/(\[[^\]]{2,}\])\s*(.*)/);
      if (!m) continue;
      if (/^\[(닫기|확인|검색|취소|이전|다음|홈|메뉴)\]$/.test(m[1])) continue;
      const loc = m[2].trim() ? m[1] + " " + m[2].trim() : m[1];
      let cat = "";
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        const nl = lines[j].trim();
        if (nl.length < 2) continue;
        if (/\[[^\]]{2,}\]/.test(nl)) break;
        if (/[가-힣]/.test(nl) && nl.length > 3) {
          cat = nl;
          break;
        }
      }
      out.push({ location: loc, category: cat });
      if (out.length >= 2) break;
    }

    // Strategy 2: keyword fallback
    if (out.length === 0) {
      let ki = -1;
      for (let s = 0; s < lines.length; s++) {
        if (/서가|진열|위치|매대|평대|꽂이/.test(lines[s])) {
          ki = s;
          break;
        }
      }
      if (ki >= 0) {
        let cat = "";
        for (let j = ki + 1; j < Math.min(ki + 3, lines.length); j++) {
          if (/[가-힣]/.test(lines[j]) && lines[j].trim().length > 3) {
            cat = lines[j].trim();
            break;
          }
        }
        out.push({ location: lines[ki].trim(), category: cat });
      }
    }
  } catch (parseErr) {
    console.log("doParseShelf error: " + String(parseErr));
  }
  return out;
}

// ============================================================
// GET /notices (공지사항 목록 조회)
// ============================================================
app.get(`${PREFIX}/notices`, async (c) => {
  try {
    const entries = await kv.getByPrefix("notice-");
    const notices = entries
      .filter(e => e && e.id)
      .map(e => ({
        id: e.id, title: e.title, content: e.content, createdAt: e.createdAt, updatedAt: e.updatedAt
      }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return c.json({ notices });
  } catch (e) {
    return c.json({ error: String(e) }, 500);
  }
});

// ============================================================
// POST /notices (공지사항 등록)
// ============================================================
app.post(`${PREFIX}/notices`, async (c) => {
  try {
    const { password, title, content } = await c.req.json();
    if (!password || !title || !content) return c.json({ error: "필수 항목이 누락되었습니다." }, 400);
    const id = crypto.randomUUID();
    const notice = { id, password, title, content, createdAt: new Date().toISOString() };
    await kv.set(`notice-${id}`, notice);
    return c.json({ notice: { id, title, content, createdAt: notice.createdAt } });
  } catch (e) {
    return c.json({ error: String(e) }, 500);
  }
});

// ============================================================
// PUT /notices/:id (공지사항 수정)
// ============================================================
app.put(`${PREFIX}/notices/:id`, async (c) => {
  try {
    const id = c.req.param("id");
    const { password, title, content } = await c.req.json();
    const existing = await kv.get(`notice-${id}`);
    if (!existing) return c.json({ error: "게시글을 찾을 수 없습니다." }, 404);
    if (existing.password !== password) return c.json({ error: "비밀번호가 일치하지 않습니다." }, 403);
    
    existing.title = title;
    existing.content = content;
    existing.updatedAt = new Date().toISOString();
    await kv.set(`notice-${id}`, existing);
    return c.json({ notice: { id, title: existing.title, content: existing.content, createdAt: existing.createdAt, updatedAt: existing.updatedAt } });
  } catch (e) {
    return c.json({ error: String(e) }, 500);
  }
});

// ============================================================
// DELETE /notices/:id (공지사항 삭제)
// ============================================================
app.delete(`${PREFIX}/notices/:id`, async (c) => {
  try {
    const id = c.req.param("id");
    const { password } = await c.req.json();
    const existing = await kv.get(`notice-${id}`);
    if (!existing) return c.json({ error: "게시글을 찾을 수 없습니다." }, 404);
    if (existing.password !== password) return c.json({ error: "비밀번호가 일치하지 않습니다." }, 403);
    
    await kv.del(`notice-${id}`);
    return c.json({ success: true });
  } catch (e) {
    return c.json({ error: String(e) }, 500);
  }
});

Deno.serve(app.fetch);