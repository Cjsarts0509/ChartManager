import { projectId, publicAnonKey } from '../../utils/supabase/info';

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-22196a99`;

export interface CloudFileInfo {
  exists: boolean;
  weekKey?: string;
  title?: string;
  filename?: string;
  uploadedAt?: string;
  url?: string;
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
 * Upload an excel file with auto-detected weekKey
 */
export async function uploadToCloud(
  file: File,
  weekKey: string,
  title: string
): Promise<void> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('weekKey', weekKey);
  formData.append('title', title);

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
