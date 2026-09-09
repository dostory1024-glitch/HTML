import {initializeApp,type FirebaseOptions} from 'firebase/app';
import {getAuth,signInAnonymously} from 'firebase/auth';
import {getDatabase,ref,get,set,update,remove,onValue,onDisconnect,runTransaction,type Database} from 'firebase/database';
type Session={id:string;host:string;remote:string};
let ready:Promise<{db:Database;uid:string}>|undefined,offset=0,lastCommand=0;
const watches=new Map<string,{value:any;error?:Error;off:()=>void;first:Promise<void>}>();
const heartbeats=new Map<string,number>(),handledTimers=new Map<string,number>();
const now=()=>Date.now()+offset;
function path(id:string){const parts=id.split('~');if(parts.length!==2||!/^[-a-zA-Z0-9_]{1,128}$/.test(parts[0])||!/^[a-f0-9]{48}$/.test(parts[1]))throw Error('QR 연결 주소가 올바르지 않습니다.');return 'slidelink/'+parts.join('/');}
async function connect(){if(!ready)ready=(async()=>{
 let config:FirebaseOptions|undefined;
 for(const url of ['/firebase-config.json','/__/firebase/init.json']){try{const r=await fetch(url);if(!r.ok)continue;const value=await r.json();if(value.apiKey&&value.databaseURL&&value.projectId){config=value;break;}}catch{}}
 if(!config)throw Error('Firebase Realtime Database 설정이 필요합니다. 배포 안내의 Firebase 설정 단계를 확인하세요.');
 const app=initializeApp(config),auth=getAuth(app);await auth.authStateReady();if(!auth.currentUser)await signInAnonymously(auth);
 const db=getDatabase(app);offset=(await get(ref(db,'.info/serverTimeOffset'))).val()||0;onValue(ref(db,'.info/serverTimeOffset'),s=>offset=s.val()||0);
 return {db,uid:auth.currentUser!.uid};
 })().catch(e=>{ready=undefined;throw Error(e.code==='auth/operation-not-allowed'?'Firebase Authentication에서 익명 로그인을 사용 설정해 주세요.':e.message);});return ready;}
async function watch(id:string){const {db}=await connect();let entry=watches.get(id);if(!entry){let resolve!:()=>void,reject!:(e:Error)=>void;const first=new Promise<void>((r,j)=>{resolve=r;reject=j;});entry={value:null,off:()=>{},first};const current=entry;entry.off=onValue(ref(db,path(id)),s=>{current.value=s.val();resolve();},e=>{current.error=e;reject(e);});watches.set(id,entry);}await entry.first;if(entry.error)throw entry.error;return entry;}
function forget(id:string){watches.get(id)?.off();watches.delete(id);heartbeats.delete(id);handledTimers.delete(id);}
function state(value:any){const time=now();if(!value||value.expires<=time)throw Error('연결이 종료되었거나 만료되었습니다. PC에서 연결을 종료하고 새 QR을 만들어 주세요.');return {online:value.state.seen>time-12000,connected:(value.controller?.seen||0)>time-12000,ready:!!value.state.ready&&value.state.seen>time-12000,timer:{elapsed:value.timer.elapsed+(value.timer.started?time-value.timer.started:0),running:!!value.timer.started},black:!!value.state.black,pointer:!!value.state.pointer};}
async function create():Promise<Session>{const {db,uid}=await connect(),secret=Array.from(crypto.getRandomValues(new Uint8Array(24)),b=>b.toString(16).padStart(2,'0')).join(''),id=uid+'~'+secret;
 const previous=await get(ref(db,'slidelink/'+uid));const cleanup:Record<string,null>={};previous.forEach(s=>{if(s.val().expires<=now())cleanup[s.key!]=null;});if(Object.keys(cleanup).length)await update(ref(db,'slidelink/'+uid),cleanup);
 await set(ref(db,path(id)),{owner:uid,expires:now()+12*3600000,state:{seen:now(),ready:false,black:false,pointer:false},timer:{elapsed:0,started:0}});
 await onDisconnect(ref(db,path(id))).remove();await watch(id);return {id,host:uid,remote:secret};}
async function timer(id:string,action:string){const {db}=await connect();await runTransaction(ref(db,path(id)+'/timer'),value=>{if(!value)return;const time=now();if(action==='start')return {...value,started:value.started||time};if(action==='timer-reset')return {elapsed:0,started:0};return {elapsed:value.elapsed+(value.started?time-value.started:0),started:value.started?0:time};},{applyLocally:false});}
export async function relayRequest(data:any,_key?:string):Promise<any>{
 if(data.op==='create')return create();const {db,uid}=await connect(),base=path(data.id),isHost=uid===data.id.split('~')[0]&&data.role!=='remote';
 if(isHost){
  if(data.op==='close'){await remove(ref(db,base));await onDisconnect(ref(db,base)).cancel();forget(data.id);return {ok:true};}
  if(data.op==='rotate'){const fresh=await create();await remove(ref(db,base));await onDisconnect(ref(db,base)).cancel();forget(data.id);return fresh;}
  if(data.op==='start'||data.op==='timer-reset'){await timer(data.id,data.op);return {ok:true};}
  if(data.op==='heartbeat'){const entry=await watch(data.id);state(entry.value);const changes:any={'state':{seen:now(),ready:!!data.ready,black:!!data.black,pointer:!!data.pointer}};for(const [key,c] of Object.entries<any>(entry.value.commands||{})){if(c.id<=data.ack||c.created<now()-30000)changes['commands/'+key]=null;}await update(ref(db,base),changes);return {ok:true};}
 }
 const entry=await watch(data.id);if(!state(entry.value).ready)throw Error('PC에서 발표 파일을 열어 주세요.');
 if(entry.value.controller?.uid!==uid||entry.value.controller?.device!==data.device)throw Error('다른 휴대폰이 연결되어 있습니다. 새 QR로 연결해 주세요.');
 if(!['next','prev','first','black','pointer','move','click','scroll','timer-toggle','timer-reset'].includes(data.action))throw Error('지원하지 않는 조작입니다.');
 lastCommand=Math.max(lastCommand+1,Math.floor(now()*1000));const command:any={id:lastCommand,action:data.action,created:now(),uid,device:data.device};
 if(data.action==='move'){if(!Number.isFinite(data.x)||!Number.isFinite(data.y))throw Error('잘못된 포인터 위치입니다.');command.x=Math.max(0,Math.min(1,data.x));command.y=Math.max(0,Math.min(1,data.y));}
 if(data.action==='scroll')command.y=Math.max(-800,Math.min(800,Number(data.y)||0));
 const slot=Array.from({length:100},(_,i)=>String(i)).find(key=>!entry.value.commands?.[key]);if(slot===undefined)throw Error('PC가 조작을 처리할 때까지 잠시 기다려 주세요.');
 await set(ref(db,base+'/commands/'+slot),command);return {ok:true};
}
export async function relayRead(id:string,role:string,_key:string,after=0,device=''):Promise<any>{
 const {db,uid}=await connect(),entry=await watch(id);state(entry.value);
 if(role==='remote'){
  if(now()-(heartbeats.get(id)||0)>3500){const result=await runTransaction(ref(db,path(id)+'/controller'),value=>{
   if(value&&(value.uid!==uid||value.device!==device)&&value.seen>now()-15000)return;
   return {uid,device,seen:now()};
  },{applyLocally:false});if(!result.committed)throw Error('다른 휴대폰이 연결되어 있습니다. PC에서 새 QR을 만들어 주세요.');heartbeats.set(id,now());}
  if(entry.value?.controller&&(entry.value.controller.uid!==uid||entry.value.controller.device!==device))throw Error('다른 휴대폰이 연결되어 있습니다.');
  return state(entry.value);
 }
 if(uid!==id.split('~')[0])throw Error('발표자 권한이 없습니다.');
 const commands=Object.values<any>(entry.value.commands||{}).filter(c=>c.id>after&&c.created>now()-30000).sort((a,b)=>a.id-b.id);
 for(const c of commands)if(c.action.startsWith('timer-')&&c.id>(handledTimers.get(id)||0)){await timer(id,c.action);handledTimers.set(id,c.id);}
 return {...state(entry.value),commands:commands.map(c=>c.action.startsWith('timer-')?{...c,action:'timer-handled'}:c)};
}
