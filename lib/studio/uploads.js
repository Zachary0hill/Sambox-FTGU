import { Upload } from 'tus-js-client';

export const MAX_PROJECT_FILE_BYTES = 1024 * 1024 * 1024;
export const UPLOAD_CHUNK_BYTES = 6 * 1024 * 1024;
const listeners = new Set();
let snapshot = [];
export const getUploads = () => snapshot;
const empty = [];
export const getServerUploads = () => empty;
export const subscribeUploads = (listener) => { listeners.add(listener); return () => listeners.delete(listener); };
function publish(task, patch) {
  Object.assign(task, patch);
  snapshot = [...snapshot.filter((t) => t.id !== task.id), { ...task }];
  listeners.forEach((f) => f());
}
export function dismissUpload(id) {
  snapshot = snapshot.filter((t) => t.id !== id);
  listeners.forEach((f) => f());
}
export const uploadInProgress = (key) => snapshot.some((t) => t.key === key && t.status !== 'complete');
export function storageUploadEndpoint(url) {
  const endpoint = new URL(url);
  if (/^[^.]+\.supabase\.co$/.test(endpoint.hostname)) endpoint.hostname = endpoint.hostname.replace('.supabase.co', '.storage.supabase.co');
  endpoint.pathname = '/storage/v1/upload/resumable';
  endpoint.search = ''; endpoint.hash = '';
  return endpoint.toString();
}
export function uploadErrorMessage(error) {
  const status = error?.originalResponse?.getStatus?.();
  if (status === 413 || /maximum allowed size|Payload too large/i.test(error?.message || '')) return 'This file exceeds the storage upload limit. Project files can be up to 1 GB.';
  if (status === 401 || status === 403) return 'Upload access expired or was denied. Sign in again, then retry.';
  // TUS errors can contain signed URLs and request headers. Keep those out of the UI.
  return 'Upload could not finish. Check your connection and retry; completed chunks are kept while this tab stays open.';
}

// All requests use the member's token; Storage enforces the existing bucket RLS.
// This resumes network failures in the same tab. Reloading the page starts a new upload.
export function createUploadTransport({ sb, path, file, onProgress = () => {}, onRetry = () => {} }) {
  if (file.size > MAX_PROJECT_FILE_BYTES) throw new Error('Project files can be up to 1 GB.');
  let resolveRun, rejectRun;
  const upload = new Upload(file, {
    endpoint: storageUploadEndpoint(process.env.NEXT_PUBLIC_SUPABASE_URL),
    chunkSize: UPLOAD_CHUNK_BYTES,
    retryDelays: [0, 1000, 3000, 5000, 10000, 20000],
    uploadDataDuringCreation: true,
    storeFingerprintForResuming: false,
    headers: { 'x-upsert': 'false' },
    metadata: { bucketName: 'project-assets', objectName: path, contentType: file.type || 'application/octet-stream', cacheControl: '3600' },
    onBeforeRequest: async (request) => {
      const current = await sb.auth.getSession();
      if (current.error || !current.data.session) throw new Error('Sign in before uploading a file.');
      request.setHeader('authorization', 'Bearer ' + current.data.session.access_token);
    },
    onShouldRetry(error, attempt, options) {
      const status = error.originalResponse?.getStatus?.() || 0;
      const retry = (status === 0 || status === 409 || status === 423 || status === 429 || status >= 500) && attempt < options.retryDelays.length;
      if (retry) onRetry();
      return retry;
    },
    onProgress,
    onError: (error) => rejectRun(new Error(uploadErrorMessage(error))),
    onSuccess: () => resolveRun(),
  });
  return { run: () => new Promise((resolve, reject) => { resolveRun = resolve; rejectRun = reject; upload.start(); }), cancel: async () => { await upload.abort(); rejectRun?.(new Error('Upload canceled.')); } };
}

// A single transport instance survives retries, including a manual Retry after the
// automatic retry budget is exhausted. Metadata is committed only after all bytes.
export async function managedUpload({ key, file, transfer, commit, onComplete = () => {} }) {
  if (uploadInProgress(key)) return false;
  const task = { id: crypto.randomUUID(), key, name: file.name, loaded: 0, total: file.size, status: 'uploading', message: '', retry: null };
  let stored = false;
  let transport;
  let running = false;
  const run = async () => {
    if (running) return false;
    running = true;
    publish(task, { status: stored ? 'saving' : 'uploading', message: '' });
    try {
      if (!stored) {
        // transfer returns a retryable transport promise; the transport itself owns chunk offsets.
        transport ||= transfer((loaded, total) => publish(task, { loaded, total, status: 'uploading' }), () => publish(task, { status: 'retrying' }));
        await transport.run();
        stored = true;
      }
      publish(task, { status: 'saving', loaded: file.size });
      await commit();
      publish(task, { status: 'complete', message: 'Uploaded' });
      onComplete();
      return true;
    } catch (error) {
      publish(task, { status: 'error', message: stored ? 'The file uploaded, but saving it to the project failed. Retry to finish without uploading it again.' : error.message || 'Could not upload this file. Retry to finish.' });
      return false;
    } finally { running = false; }
  };
  task.cancel = async () => { if (running) return; await transport?.cancel?.(); dismissUpload(task.id); };
  task.retry = run;
  return run();
}
