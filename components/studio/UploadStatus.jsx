'use client';
import { useEffect, useSyncExternalStore } from 'react';
import { subscribeUploads, getUploads, getServerUploads, dismissUpload } from '@/lib/studio/uploads';
export default function UploadStatus() {
  const tasks = useSyncExternalStore(subscribeUploads, getUploads, getServerUploads);
  const busy = tasks.some((t) => ['uploading','saving','retrying'].includes(t.status));
  useEffect(() => {
    if (!busy) return;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [busy]);
  if (!tasks.length) return null;
  return <aside aria-label="File uploads" style={{position:'fixed',right:16,bottom:16,zIndex:10000,width:'min(360px, calc(100vw - 32px))',maxHeight:'45vh',overflowY:'auto',padding:16,boxSizing:'border-box',border:'1px solid #ddd',borderRadius:16,background:'#fff',color:'#111',boxShadow:'0 8px 28px #0002'}}>
    <strong>File uploads</strong>
    {tasks.map(t => <div key={t.id} style={{marginTop:12}}>
      <div style={{overflowWrap:'anywhere',fontSize:13}}>{t.name}</div>
      <progress aria-label={'Upload progress for '+t.name} max={t.total} value={t.loaded} style={{width:'100%'}} />
      <div role={t.status==='error'?'alert':'status'} style={{fontSize:12}}>{t.status==='error'?t.message:t.status==='complete'?'Uploaded':t.status==='saving'?'Saving to project…':t.status==='retrying'?'Connection interrupted. Retrying…':Math.floor(t.loaded/t.total*100)+'% uploaded'}</div>
      {t.status==='error'&&<button type="button" onClick={t.retry} style={{minHeight:44,marginTop:4}}>Retry upload</button>}
      {t.status==='error'&&<button type="button" onClick={t.cancel} style={{minHeight:44,marginLeft:8}}>Cancel upload</button>}
      {t.status==='complete'&&<button type="button" onClick={()=>dismissUpload(t.id)} style={{minHeight:44,marginTop:4}}>Dismiss upload</button>}
    </div>)}
    {busy&&<p style={{fontSize:12,marginBottom:0}}>Keep this tab open. Interrupted transfers retry automatically.</p>}
  </aside>;
}
