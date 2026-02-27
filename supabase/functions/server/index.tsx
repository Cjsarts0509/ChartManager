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

// Health check
app.get(`${PREFIX}/health`, (c) => {
  return c.json({ status: "ok" });
});

// ============================================================
// POST /upload - Upload an Excel file keyed by weekKey
// Body: FormData with:
//   - "file": the excel file
//   - "weekKey": e.g. "2026-02-02" (year-month-week, extracted from A1 title by frontend)
//   - "title": the full title string from the excel (e.g. "2026년 2월 2주간 베스트셀러")
// ============================================================
app.post(`${PREFIX}/upload`, async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get("file") as File | null;
    const weekKey = formData.get("weekKey") as string | null;
    const title = formData.get("title") as string | null;

    if (!file) {
      return c.json({ error: "No file provided" }, 400);
    }
    if (!weekKey || !/^\d{4}-\d{2}-\d{2}$/.test(weekKey)) {
      return c.json({ error: `Invalid weekKey: "${weekKey}". Expected format: "YYYY-MM-WW" (e.g. "2026-02-02")` }, 400);
    }

    const sb = supabase();
    const storagePath = `weeks/${weekKey}/data.xlsx`;

    // Upload file (upsert to overwrite existing)
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

    // Save metadata to KV (prefixed for easy retrieval)
    await kv.set(`excel-week-${weekKey}`, {
      weekKey,
      title: title || "",
      filename: file.name,
      uploadedAt: new Date().toISOString(),
      storagePath,
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
// GET /files - Get the 2 most recent files (by weekKey desc)
// Returns: { thisWeek: {...}, lastWeek: {...} } with signed URLs
// ============================================================
app.get(`${PREFIX}/files`, async (c) => {
  try {
    const sb = supabase();

    // Fetch all excel-week-* entries from KV
    const allEntries = await kv.getByPrefix("excel-week-");

    if (!allEntries || allEntries.length === 0) {
      return c.json({
        thisWeek: { exists: false },
        lastWeek: { exists: false },
      });
    }

    // Sort by weekKey descending (e.g. "2026-09" > "2026-08")
    const sorted = allEntries
      .filter((e: any) => e && e.weekKey)
      .sort((a: any, b: any) => b.weekKey.localeCompare(a.weekKey));

    const result: Record<string, any> = {};

    // Top 1 = thisWeek, Top 2 = lastWeek
    const slots = ["thisWeek", "lastWeek"];
    for (let i = 0; i < 2; i++) {
      const entry = sorted[i];
      if (entry) {
        const { data, error } = await sb.storage
          .from(BUCKET_NAME)
          .createSignedUrl(entry.storagePath, 3600);

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
// DELETE /files/:weekKey - Delete a specific week's file
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

Deno.serve(app.fetch);