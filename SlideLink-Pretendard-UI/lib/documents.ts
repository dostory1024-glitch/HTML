import {preparePresentation,type LocalFile} from './presentation';

type Reply=(data:Record<string,unknown>)=>void;
export type OpenDocument=Awaited<ReturnType<typeof preparePresentation>>&{
 handle?:(data:any,reply:Reply)=>void;
 dispose?:()=>void;
};
export const supportedFile=(name:string)=>/\.(html?|pdf|pptx)$/i.test(name);
export async function openDocument(files:LocalFile[],entry:string,channel:string):Promise<OpenDocument>{
 if(/\.pdf$/i.test(entry))return openPdf(files.find(f=>f.name===entry)!.file,channel);
 if(/\.pptx$/i.test(entry)){try{return await openPptx(files.find(f=>f.name===entry)!.file,channel);}catch{throw Error('PPTX를 열지 못했습니다. 암호가 없는 정상적인 PPTX 파일인지 확인해 주세요. PowerPoint에서 새 사본으로 저장한 뒤 다시 열어 보세요.');}}
 return preparePresentation(files,entry,channel);
}

async function shell(channel:string,kind:'pdf'|'pptx',extra=''){
 const source=`<!doctype html><html data-sl-document><head><meta charset="utf-8"><style>
 *{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#252527;color:white;font:14px system-ui}
 #viewport{position:absolute;inset:0 0 52px;overflow:hidden;display:flex;align-items:center;justify-content:center}
 #page{display:block;max-width:100%;max-height:100%;object-fit:contain}#pptx{position:absolute;left:50%;top:50%;transform-origin:center center}
 nav{position:absolute;bottom:0;left:0;right:0;height:52px;display:flex;align-items:center;justify-content:center;gap:16px;background:#1d1d1f}
 button{min-height:44px;min-width:44px;border:0;border-radius:22px;color:white;background:#353537;padding:8px 18px;cursor:pointer}button:disabled{opacity:.35}button:focus-visible{outline:3px solid #2997ff}
 #status{font-variant-numeric:tabular-nums;min-width:90px;text-align:center}#error{position:absolute;inset:20%;padding:24px;background:#1d1d1f;text-align:center;z-index:30}#error:empty{display:none}
 [class^="pptx-preview-wrapper-"]{display:none!important}
 </style><script>window.addEventListener("error",e=>window.__docError=e.message)</script>${extra}</head><body><main id="viewport"><img id="page" alt="PDF 페이지"><div id="pptx"></div></main><nav aria-label="문서 페이지"><button id="prev" aria-label="이전 페이지">←</button><span id="status" role="status">여는 중…</span><button id="next" aria-label="다음 페이지">→</button></nav><div id="error" role="alert"></div><script>(${documentRuntime.toString()})(${JSON.stringify(channel)},${JSON.stringify(kind)})</script></body></html>`;
 return preparePresentation([{name:'viewer.html',file:new File([source],'viewer.html',{type:'text/html'})}],'viewer.html',channel);
}

async function openPdf(file:File,channel:string):Promise<OpenDocument>{
 const pdfjs=await import('pdfjs-dist');
 pdfjs.GlobalWorkerOptions.workerSrc=(await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
 const task=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),enableXfa:false,
  cMapUrl:'/pdfjs/cmaps/',cMapPacked:true,standardFontDataUrl:'/pdfjs/standard_fonts/',wasmUrl:'/pdfjs/wasm/'});
 let disposed=false,active:ReturnType<import('pdfjs-dist').PDFPageProxy['render']>|undefined;
 try{
 const pdf=await task.promise;
 const result=await shell(channel,'pdf');
 let running=false,pending:{page:number;ticket:number;reply:Reply}|undefined;
 async function pump(){if(running)return;running=true;try{while(pending&&!disposed){
  const job=pending;pending=undefined;
  let page:import('pdfjs-dist').PDFPageProxy|undefined;
  try{page=await pdf.getPage(job.page);if(disposed)return;
   const raw=page.getViewport({scale:1}),scale=Math.min(2.5,2400/Math.max(raw.width,raw.height));
   const viewport=page.getViewport({scale}),canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
   active=page.render({canvas,viewport});await active.promise;active=undefined;
   if(!disposed&&!pending)job.reply({action:'document-page',page:job.page,ticket:job.ticket,image:canvas.toDataURL('image/png')});canvas.width=canvas.height=0;
  }catch(error){if(!disposed&&!pending)job.reply({action:'document-error',message:'PDF 페이지를 표시하지 못했습니다. '+(error as Error).message});}
  finally{page?.cleanup();}
 }}finally{running=false;}}
 return {...result,handle(data,reply){
  if(disposed)return;
  if(data.type==='document-init')reply({action:'document-open',total:pdf.numPages});
  if(data.type==='document-request'&&Number.isInteger(data.page)&&data.page>=1&&data.page<=pdf.numPages){pending={page:data.page,ticket:data.ticket,reply};void pump();}
 },dispose(){disposed=true;pending=undefined;active?.cancel();void task.destroy();}};
 }catch(error){await task.destroy();throw Error((error as any).name==='PasswordException'?'암호가 걸린 PDF입니다. 암호를 해제한 사본을 열어 주세요.':'PDF를 열지 못했습니다. '+(error as Error).message);}
}

async function openPptx(file:File,channel:string):Promise<OpenDocument>{
 // Third-party PPTX HTML runs in the existing opaque sandbox, never in the app DOM.
 const library=(await import('pptx-preview/dist/pptx-preview.umd.js?raw')).default;
 const {default:JSZip}=await import('jszip');
 const zip=await JSZip.loadAsync(await file.arrayBuffer());
 const presentation=zip.file('ppt/presentation.xml');if(!presentation)throw Error('올바른 PPTX 파일이 아닙니다.');
 const parse=(xml:string)=>new DOMParser().parseFromString(xml,'application/xml');
 const size=parse(await presentation.async('string')).getElementsByTagNameNS('*','sldSz')[0];
 const width=1280,ratio=Number(size?.getAttribute('cy'))/Number(size?.getAttribute('cx'));
 if(!Number.isFinite(ratio)||ratio<.1||ratio>10)throw Error('PPTX 슬라이드 크기를 확인할 수 없습니다.');
 // Materialize paragraph defaults on runs for the preview engine; preserve run overrides.
 const ns='http://schemas.openxmlformats.org/drawingml/2006/main';
 for(const entry of Object.values(zip.files).filter(f=>/^ppt\/slides\/slide\d+\.xml$/.test(f.name))){
  const xml=parse(await entry.async('string'));let changed=false;
  for(const paragraph of Array.from(xml.getElementsByTagNameNS(ns,'p'))){
   const props=Array.from(paragraph.children).find(x=>x.localName==='pPr');
   const defaults=props&&Array.from(props.children).find(x=>x.localName==='defRPr');if(!defaults)continue;
   for(const run of Array.from(paragraph.children).filter(x=>x.localName==='r'||x.localName==='fld')){
    let rpr=Array.from(run.children).find(x=>x.localName==='rPr');if(!rpr){rpr=xml.createElementNS(ns,'a:rPr');run.insertBefore(rpr,run.firstChild);}
    for(const attr of Array.from(defaults.attributes))if(!rpr.hasAttribute(attr.name))rpr.setAttribute(attr.name,attr.value);
    for(const child of Array.from(defaults.children))if(!Array.from(rpr.children).some(x=>x.localName===child.localName))rpr.appendChild(child.cloneNode(true));changed=true;
   }
  }if(changed)zip.file(entry.name,new XMLSerializer().serializeToString(xml));
 }
 let data:ArrayBuffer|null=await zip.generateAsync({type:'arraybuffer'});
 const result=await shell(channel,'pptx',`<script>${library.replace(/<\/script/gi,'<\\/script')}</script>`);
 return {...result,handle(message,reply){if(message.type==='document-init'&&data)reply({action:'document-open',buffer:data,width,height:width*ratio});},dispose(){data=null;}};
}

// This function is serialized into the sandbox; keep all dependencies inside it.
function documentRuntime(channel:string,kind:'pdf'|'pptx'){
 const emit=(type:string,data:any={})=>parent.postMessage({channel,type,...data},'*');
 const prev=document.getElementById('prev') as HTMLButtonElement,next=document.getElementById('next') as HTMLButtonElement,
  status=document.getElementById('status')!,error=document.getElementById('error')!,image=document.getElementById('page') as HTMLImageElement,
  host=document.getElementById('pptx')!,viewport=document.getElementById('viewport')!;
 let total=0,current=1,ticket=0,ready=false,viewer:any,baseWidth=1280,baseHeight=720;
 const deadline=setTimeout(()=>fail('문서를 여는 데 시간이 오래 걸립니다. 파일을 다시 열어 주세요.'),45000);
 function fail(message:string){clearTimeout(deadline);error.textContent=message;emit('error',{message});}
 function fit(){if(kind!=='pptx')return;const scale=Math.min(viewport.clientWidth/baseWidth,viewport.clientHeight/baseHeight);host.style.transform=`translate(-50%,-50%) scale(${scale})`;}
 function announce(){clearTimeout(deadline);error.textContent='';status.textContent=current+' / '+total;prev.disabled=current<=1;next.disabled=current>=total;emit('document-position',{page:current,total});if(!ready){ready=true;document.dispatchEvent(new Event('sl-document-ready'));}}
 function show(page:number){if(!total)return;current=Math.max(1,Math.min(total,page));prev.disabled=current<=1;next.disabled=current>=total;
  if(kind==='pdf'){image.style.opacity='.3';status.textContent=current+' / '+total+' · 로딩';emit('document-request',{page:current,ticket:++ticket});}
  else{try{viewer.renderSingleSlide(current-1);fit();announce();}catch(e){fail('PPTX 슬라이드를 표시하지 못했습니다. '+(e as Error).message);}}
 }
 prev.onclick=()=>show(current-1);next.onclick=()=>show(current+1);
 addEventListener('keydown',e=>{if(['ArrowRight','PageDown',' ','ArrowLeft','PageUp','Home','End'].includes(e.key)){e.preventDefault();show(e.key==='Home'?1:e.key==='End'?total:current+(['ArrowLeft','PageUp'].includes(e.key)?-1:1));}});
 addEventListener('resize',fit);
 addEventListener('message',async e=>{if(e.source!==parent||e.data?.channel!==channel)return;const d=e.data;
  if(d.action==='document-open'){try{
   if(kind==='pdf'){total=d.total;host.remove();show(1);}
   else{image.remove();const api=(window as any).pptxPreview;if(!api?.init)throw Error((window as any).__docError||'PPTX 미리보기 모듈을 불러오지 못했습니다.');
    baseWidth=d.width;baseHeight=d.height;viewer=api.init(host,{width:baseWidth,height:baseHeight,mode:'slide'});await viewer.load(d.buffer);total=viewer.slideCount;
    if(!total)throw Error('슬라이드가 없는 파일입니다.');host.style.width=baseWidth+'px';host.style.height=baseHeight+'px';show(1);
   }
  }catch(e){fail('문서를 열지 못했습니다. '+(e as Error).message);}}
  if(d.action==='document-page'&&d.ticket===ticket&&d.page===current){image.onload=()=>{if(d.ticket===ticket){image.style.opacity='1';announce();}};image.src=d.image;}
  if(d.action==='document-error')fail(d.message);
 });
 addEventListener('load',()=>emit('document-init'),{once:true});
}

