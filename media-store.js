/* F-EDITOR-UX-05 Pilot-local binary draft store. No backend or publish API.
   Binary lives in IndexedDB, never in localStorage. Draft metadata stays in the
   existing versioned localStorage record. Fail closed if a binary is unavailable. */
(() => {
  'use strict';
  const DB='dkt-editorial-draft-media-v1', STORE='files', VERSION=1;
  const PREFIX='editorial/round-2a-v0.1.5/';
  let connection;
  const open=()=>{
    if(!('indexedDB' in window))return Promise.reject(new Error('Trình duyệt không hỗ trợ lưu tệp nháp.'));
    if(connection)return connection;
    connection=new Promise((resolve,reject)=>{
      const req=indexedDB.open(DB,VERSION);
      req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE);};
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error||new Error('Không mở được kho lưu tệp.'));
      req.onblocked=()=>reject(new Error('Kho tệp đang được sử dụng ở cửa sổ khác.'));
    });
    return connection;
  };
  const transact=async(key,mode,op,value)=>{
    const db=await open();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,mode),store=tx.objectStore(STORE);
      let result;
      const req=op==='get'?store.get(PREFIX+key):op==='delete'?store.delete(PREFIX+key):store.put(value,PREFIX+key);
      req.onsuccess=()=>{result=req.result;};
      req.onerror=()=>reject(req.error||new Error('Không truy cập được tệp.'));
      tx.oncomplete=()=>resolve(result);
      tx.onerror=()=>reject(tx.error||new Error('Không lưu được tệp.'));
      tx.onabort=()=>reject(tx.error||new Error('Thao tác lưu tệp bị hủy.'));
    });
  };
  window.__dktMediaStore={
    get:key=>transact(key,'readonly','get'),
    put:(key,blob,poster=null)=>transact(key,'readwrite','put',{blob,poster,savedAt:new Date().toISOString()}),
    remove:key=>transact(key,'readwrite','delete'),
    async verify(key){const x=await transact(key,'readonly','get');return !!(x?.blob instanceof Blob);},
    // Shared reader/editor renderer. Media replaces placeholder presentation,
    // while interaction buttons and geometry are retained.
    async show(slotId,target,meta,{file=null,poster=null}={}){
      if(!target||!meta||meta.removed||!meta.file_name)return false;
      if(!file){const record=await transact(slotId,'readonly','get');file=record?.blob;poster=record?.poster;}
      if(!(file instanceof Blob))return false;
      target.querySelectorAll(':scope > .ec-slot-media').forEach(x=>x.remove());
      const wrap=document.createElement('div');wrap.className='ec-slot-media';
      const isVideo=meta.media_type==='VIDEO';
      const media=document.createElement(isVideo?'video':'img');
      media.className=isVideo?'ec-preview-video':'ec-preview-image';
      media.src=URL.createObjectURL(file);
      if(isVideo){media.controls=true;media.preload='metadata';media.loop=!!meta.loop;media.autoplay=!!meta.autoplay;media.muted=!!meta.autoplay;if(poster instanceof Blob)media.poster=URL.createObjectURL(poster);}
      else media.alt=meta.decorative?'':meta.alt_text||meta.caption||'Ảnh tư liệu';
      wrap.append(media);
      if(meta.show_caption&&meta.caption){const cap=document.createElement('p');cap.className='ec-reader-caption';cap.textContent=meta.caption;wrap.append(cap);}
      if(meta.credit){const credit=document.createElement('p');credit.className='ec-reader-credit';credit.textContent=meta.credit;wrap.append(credit);}
      target.classList.add('ec-has-real-media');
      if(target.matches('.asset-frame')){const placeholder=target.querySelector(':scope > .placeholder-art');if(placeholder)placeholder.hidden=true;const cap=target.querySelector(':scope > figcaption');if(cap)cap.hidden=true;}
      if(target.matches('.photo-fallback')){const placeholder=target.querySelector(':scope > .placeholder-label');if(placeholder)placeholder.hidden=true;}
      target.append(wrap);
      return true;
    }
  };
})();