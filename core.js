/* ---------- Constants ---------- */
const STATUSES=[
  {k:'邀約洽談',c:'#7a4d78',bg:'#efe3f0'},
  {k:'已投遞',c:'#3d6fa8',bg:'#e1eaf5'},
  {k:'面試中',c:'#a8721a',bg:'#f8ecd2'},
  {k:'等待結果',c:'#2a7f86',bg:'#dcefef'},
  {k:'錄取',c:'#2f5d4a',bg:'#dfeae2'},
  {k:'未錄取',c:'#c04a31',bg:'#f6e0da'},
  {k:'無回應',c:'#6f756d',bg:'#ebe8e0'}
];
const CLOSED=['錄取','未錄取','無回應'];
const FIELDS=['company','position','category','origin','date','channel','status','location','salary','contact','next','nextDate','link','note'];
const LABELS={company:'公司',position:'職位',category:'公司類別',origin:'來源類型',date:'日期',channel:'管道',status:'狀態',location:'地點',salary:'薪資',contact:'聯絡人',next:'下一步',nextDate:'下一步日期',link:'連結',note:'備註'};
const ALIASES={
  company:['公司','公司名稱','企業','company','company name'],
  position:['職位','職缺','職稱','應徵職位','position','title','job','role','job title'],
  category:['公司類別','類別','分類','公司分類','產業','category','industry','tier','tag'],
  origin:['來源類型','類型','投遞類型','主被動','主動/被動','origin','type'],
  date:['投遞日期','日期','聯繫日期','邀約日期','應徵日期','申請日期','投遞時間','date','applied','applied date','apply date'],
  channel:['管道','來源','平台','渠道','channel','source','platform'],
  status:['狀態','進度','結果','status','stage'],
  location:['地點','地區','工作地點','location','city'],
  salary:['薪資','薪水','待遇','salary','pay'],
  contact:['聯絡人','聯絡窗口','hr','contact','recruiter'],
  next:['下一步','待辦','next','next step','todo'],
  nextDate:['下一步日期','next date'],
  link:['連結','網址','職缺連結','link','url'],
  note:['備註','筆記','心得','note','notes','memo','remark']
};
const ROUNDS=['筆試/測驗','一面','二面','三面','四面','主管面','HR面','終面'];
const MODES=['線上','現場','電話'];
const RESULTS=['待面試','等結果','通過','未通過'];
const WD='日一二三四五六';
const KEY='job-tracker-v1';

/* ---------- State ---------- */
let data=JSON.parse(localStorage.getItem(KEY)||'[]');
// older versions stored unknown interview times as midnight; treat those as date-only
data.forEach(d=>(d.interviews||[]).forEach(iv=>{if(/T00:00$/.test(iv.when||''))iv.when=iv.when.slice(0,10)}));
let filter=null, attnOnly=false, editingId=null, visibleIds=[], view='table';
let page=1, pageSize=+localStorage.getItem(KEY+'-pagesize')||20;
let sortKey='date', sortDir=-1;
let ghostOnly=false, hiddenClosed=0;
const selected=new Set();
// the filter row: company, category, channel, location, date range
const F={co:'',cat:'',ch:'',loc:'',from:'',to:''};
let groupCo=localStorage.getItem(KEY+'-group')==='1';
let anFiltered=localStorage.getItem(KEY+'-anf')==='1';
const collapsedCo=new Set();

/* ---------- Helpers ---------- */
const $=s=>document.querySelector(s);
const PHONE=matchMedia('(max-width:640px)');
// lastRaw is what this tab last wrote or loaded, so a change from another tab can be told apart
let lastRaw=null;
const save=()=>{lastRaw=JSON.stringify(data);localStorage.setItem(KEY,lastRaw)};
const uid=()=>Math.random().toString(36).slice(2,10);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const st=k=>STATUSES.find(s=>s.k===k)||STATUSES[1];
const org=d=>d.origin==='公司邀約'?'公司邀約':'主動投遞';
const pad=n=>String(n).padStart(2,'0');
// all dates use the browser's local time zone, not UTC
const ymd=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const todayStr=()=>ymd(new Date());
function parseDay(s){const m=String(s||'').match(/^(\d{4})-(\d{2})-(\d{2})/);return m?new Date(+m[1],m[2]-1,+m[3]):null}
function daysSince(s){const t=parseDay(s);if(!t)return null;const now=new Date();now.setHours(0,0,0,0);return Math.round((now-t)/864e5)}
// interview times are "YYYY-MM-DDTHH:MM", or just "YYYY-MM-DD" when the time is unknown
const hasTime=s=>/T\d/.test(s||'');
const ivStart=s=>hasTime(s)?new Date(s):parseDay(s);
const fmtDT=s=>s?(hasTime(s)?s.replace('T',' '):s+'（時間未定）'):'';
function isFuture(s){
  const t=s&&ivStart(s);if(!t||isNaN(t))return false;
  if(!hasTime(s))t.setDate(t.getDate()+1);// date-only counts as upcoming until the day ends
  return t>new Date();
}

/* ---------- Toast + undo ---------- */
let undoSnap=null;
// an open dialog covers everything outside it, so the toast moves into whichever dialog is open
function placeToast(){
  const t=$('#toast'), host=[...document.querySelectorAll('dialog[open]')].pop()||document.body;
  if(t.parentNode!==host)host.appendChild(t);
}
function toast(msg,opt={}){
  const t=$('#toast'), b=$('#toastAct');placeToast();
  $('#toastMsg').textContent=msg;
  b.hidden=!opt.undo;t.classList.toggle('has-act',!!opt.undo);
  b.textContent='復原';
  b.onclick=()=>{if(!undoSnap)return;data=JSON.parse(undoSnap);undoSnap=null;save();render();
    // an open details view would otherwise keep showing the undone change
    if($('#vdlg').open)data.some(d=>d.id===viewingId)?openView(viewingId):$('#vdlg').close();
    toast('已復原')};
  t.classList.add('show');clearTimeout(t._t);
  t._t=setTimeout(()=>{t.classList.remove('show');if(opt.undo)undoSnap=null},opt.undo?10000:2200);
}
function snapshot(){undoSnap=JSON.stringify(data)}

/* ---------- Interviews ---------- */
function ivText(iv){return [iv.round,(iv.when||'').replace('T',' '),iv.mode,iv.result].filter(Boolean).join(' ')+(iv.note?`（${iv.note}）`:'')}
// rounds are separated by ；/;/new line, but only outside the （notes）, so a note that
// itself contains ；or a line break stays in one piece instead of turning into extra rounds
function splitIvText(t){
  const out=[];let cur='',depth=0;
  for(const ch of String(t||'')){
    if(ch==='（'||ch==='(')depth++;
    else if((ch==='）'||ch===')')&&depth)depth--;
    if(!depth&&/[；;\n]/.test(ch)){out.push(cur);cur=''}else cur+=ch;
  }
  out.push(cur);
  return out.map(s=>s.trim()).filter(Boolean);
}
function parseIvText(t){
  return splitIvText(t).map(s=>{
    const m=s.match(/^(\S+)\s*(\d{4}-\d{2}-\d{2})?\s*(\d{1,2}:\d{2})?\s*(線上|現場|電話)?\s*(待面試|等結果|通過|未通過)?\s*(?:[（(]([\s\S]*)[）)])?$/);
    if(!m)return {round:s,when:'',mode:'',result:'待面試',note:''};
    return {round:m[1],when:m[2]?(m[3]?m[2]+'T'+m[3].padStart(5,'0'):m[2]):'',mode:m[4]||'',result:m[5]||'待面試',note:m[6]||''};
  });
}
function nextInterview(d){return (d.interviews||[]).filter(x=>isFuture(x.when)).sort((a,b)=>a.when.localeCompare(b.when))[0]}
function currentInterview(d){const l=d.interviews||[];return nextInterview(d)||l[l.length-1]}

/* ---------- Status <-> interview link ---------- */
const PENDING=['待面試','等結果'];
const roundIdx=r=>{const i=ROUNDS.indexOf(r);return i<0?99:i};
// dated rounds in time order; undated ones fall back to the usual round order
function sortInterviews(l){return l.sort((a,b)=>a.when&&b.when?a.when.localeCompare(b.when):roundIdx(a.round)-roundIdx(b.round))}
const lastRound=d=>{const l=d.interviews||[];return l[l.length-1]};
function lastDone(d){return (d.interviews||[]).filter(x=>x.when&&!isFuture(x.when)).sort((a,b)=>a.when.localeCompare(b.when)).pop()}
const daysSinceIv=iv=>daysSince(iv.when.slice(0,10));
/*
  Status rules — one source of truth:
  1. A status the user picks (drag, dropdown, bulk, dialog) is final. Only the latest
     interview round is nudged so the two read consistently; the status itself is never changed.
  2. The status is derived from interviews ONLY while the user edits interviews in the dialog.
  3. Loading the page or restoring a backup never changes a status.
*/
function applyStatusToInterviews(d,S){
  const r=lastRound(d);if(!r)return;
  if(S==='未錄取'){if(PENDING.includes(r.result))r.result='未通過';return}
  if(S==='錄取'){r.result='通過';return}
  if(S==='等待結果'){if(r.result!=='通過')r.result='等結果';return}
  if(S==='面試中'){if(r.result==='未通過')r.result='待面試';return}
  // 已投遞 / 邀約洽談 / 無回應: keep the interview history exactly as it is
}
const OPEN=['已投遞','邀約洽談','面試中','等待結果'];
function deriveStatus(d){
  const l=d.interviews||[];if(!l.length)return;
  const r=lastRound(d), S=st(d.status).k;
  if(S==='錄取')return;
  if(r.result==='未通過'){d.status='未錄取';return}
  if(S==='未錄取'&&!PENDING.includes(r.result))return;
  d.status=r.result==='等結果'&&!nextInterview(d)?'等待結果':'面試中';
}
function normalizeRecord(d){
  if((d.interviews||[]).length)sortInterviews(d.interviews);
  return d;
}
const syncStatus=deriveStatus;// old name, kept so nothing breaks

/* ---------- Attention rules ---------- */
function attention(d){
  const S=st(d.status).k, out=[];
  if(CLOSED.includes(S))return out;
  const t=todayStr();
  if(d.nextDate&&d.nextDate<t)out.push({k:'over',t:'下一步已過期'});
  else if(d.nextDate===t)out.push({k:'today',t:'今天要處理'});
  const ds=daysSince(d.date);
  if(S==='已投遞'&&ds!==null&&ds>=14&&!(d.nextDate&&d.nextDate>=t))out.push({k:'over',t:'可追蹤'});
  if(S==='邀約洽談'&&ds!==null&&ds>=5)out.push({k:'over',t:'邀約待回覆'});
  if((d.interviews||[]).some(x=>x.result==='待面試'&&x.when&&!isFuture(x.when)))out.push({k:'today',t:'面試結果待更新'});
  const ld=lastDone(d);
  if(ld&&ld.result==='等結果'&&!nextInterview(d)){const n=daysSinceIv(ld);if(n>=7)out.push({k:'over',t:`已等 ${n} 天・可追蹤`})}
  return out;
}
// applied 30+ days ago, no interviews and nothing scheduled: probably a silent rejection
function ghost(d){
  const ds=daysSince(d.date);
  return st(d.status).k==='已投遞'&&ds!==null&&ds>=30&&!(d.interviews||[]).length&&!(d.nextDate&&d.nextDate>=todayStr());
}
// interviewed, then 14+ days without a result or anything scheduled
function ivGhost(d){
  if(!['面試中','等待結果'].includes(st(d.status).k)||nextInterview(d)||(d.nextDate&&d.nextDate>=todayStr()))return false;
  const ld=lastDone(d);
  return !!ld&&PENDING.includes(ld.result)&&daysSinceIv(ld)>=14;
}

/* ---------- Normalizers ---------- */
function serialToDate(v){return new Date(Math.round((+v-25569)*864e5))}
function normDate(v){
  if(v==null||v==='')return '';
  if(typeof v==='number'||/^\d{5}(\.\d+)?$/.test(v)){const d=serialToDate(v);return `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}`}
  const s=String(v).trim().replace(/[年月.]/g,'/').replace(/日/,'');
  const m=s.match(/^(\d{2,4})[\/-](\d{1,2})[\/-](\d{1,2})/);
  if(m){let y=+m[1];if(y<1911)y+=1911;return `${y}-${pad(m[2])}-${pad(m[3])}`}
  const d=new Date(s);return isNaN(d)?String(v):ymd(d);
}
function normDT(v){
  if(v==null||v==='')return '';
  if(typeof v==='number'||/^\d{5}(\.\d+)?$/.test(v)){
    const d=serialToDate(v), day=`${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}`;
    return +v%1===0?day:`${day}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
  }
  const s=String(v).trim(), day=normDate(s.split(/\s+/)[0]);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day))return '';
  const t=s.match(/(\d{1,2})[:：](\d{2})/);
  if(!t)return day;// no time given: keep it date-only
  let h=+t[1];if(/下午|pm/i.test(s)&&h<12)h+=12;
  return `${day}T${pad(h)}:${t[2]}`;
}
function normStatus(v){
  v=String(v||'').trim();if(!v)return '已投遞';
  if(/錄取|offer|通過|accept/i.test(v)&&!/未|不|沒|reject/i.test(v))return '錄取';
  if(/未錄取|不錄取|拒|感謝函|reject|fail|沒上/i.test(v))return '未錄取';
  if(/等(待)?(結果|通知|回覆|回應|消息)|waiting|pending/i.test(v))return '等待結果';
  if(/面試|interview|測驗|筆試|一面|二面|三面/i.test(v))return '面試中';
  if(/無回應|沒回|no reply|ghost|石沉/i.test(v))return '無回應';
  if(/邀約|洽談|獵頭|聯繫|recruit/i.test(v))return '邀約洽談';
  return '已投遞';
}
function normOrigin(v){return /邀約|獵頭|找我|主動聯[繫絡]|被動|私訊|recruit|headhunt|inbound|invite/i.test(String(v||''))?'公司邀約':'主動投遞'}

/* ---------- Duplicate detection ---------- */
const normKey=s=>String(s||'').toLowerCase().replace(/\s+/g,'').replace(/[,.]*(股份有限公司|有限公司|inc|ltd|co|corp)[,.]*$/,'');
const dupKey=d=>`${normKey(d.company)}|${normKey(d.position)}|${d.date||''}`;
function mergeInto(target,src){
  FIELDS.forEach(f=>{if(src[f])target[f]=src[f]});
  const list=target.interviews||(target.interviews=[]);
  (src.interviews||[]).forEach(iv=>{
    const same=list.find(x=>x.round===iv.round);
    if(same)Object.keys(iv).forEach(k=>{if(iv[k])same[k]=iv[k]});else list.push(iv);
  });
}
function fillDefaults(o){
  if(!o.origin)o.origin='主動投遞';
  if(!o.status){
    o.status=o.origin==='公司邀約'?'邀約洽談':'已投遞';
    if((o.interviews||[]).length){sortInterviews(o.interviews);deriveStatus(o)}
  }
  return o;
}

/* ---------- Company category ---------- */
// the category UI is switched off for now; the field is still kept in records and backups
const SHOW_CAT=false;
// a category belongs to the company: records of the same company share it
function unifyCats(){
  const m={};data.forEach(d=>{if(d.category)m[normKey(d.company)]=d.category});
  data.forEach(d=>{const c=m[normKey(d.company)];if(!d.category&&c)d.category=c});
}
const CAT_PAL=[['#e7e1f0','#5d3f5b'],['#dcefef','#1f6c72'],['#f8ecd2','#8a5d12'],['#e1eaf5','#2f5a8c'],['#f6e0da','#a43f29'],['#dfeae2','#2f5d4a'],['#ece6dc','#5a5148'],['#f3e3ea','#8c3a5e']];
function catColor(c){let h=7;for(const ch of String(c))h=(h*31+ch.charCodeAt(0))>>>0;return CAT_PAL[h%CAT_PAL.length]}
function catTag(c){const [bg,fg]=catColor(c);return `<span class="cat" data-cat="${esc(c)}" style="background:${bg};color:${fg}" title="只看「${esc(c)}」">${esc(c)}</span>`}

/* ---------- Filter row ---------- */
// the location column is often a full address, so only city / county names are picked out of it;
// well-known districts and science parks count toward their city, anything unrecognised becomes 其他
const CITY_NAMES=['台北','新北','桃園','台中','台南','高雄','基隆','新竹','苗栗','彰化','南投','雲林','嘉義','屏東','宜蘭','花蓮','台東','澎湖','金門','連江'];
const AREA_CITY={竹北:'新竹',竹東:'新竹',湖口:'新竹',新豐:'新竹',寶山:'新竹',台元:'新竹',竹科:'新竹',
  內湖:'台北',南港:'台北',信義區:'台北',大安區:'台北',汐止:'新北',板橋:'新北',新店:'新北',中和:'新北',土城:'新北',林口:'新北',三重:'新北',
  中壢:'桃園',龜山:'桃園',楊梅:'桃園',大園:'桃園',蘆竹:'桃園',西屯:'台中',中科:'台中',大雅:'台中',
  南科:'台南',善化:'台南',新市:'台南',安南:'台南',永康:'台南',楠梓:'高雄',路竹:'高雄',大寮:'高雄',前鎮:'高雄',仁武:'高雄',
  竹南:'苗栗',頭份:'苗栗',斗六:'雲林',虎尾:'雲林'};
const EN_CITY=[[/taipei/i,'台北'],[/hsinchu/i,'新竹'],[/taoyuan/i,'桃園'],[/taichung/i,'台中'],[/tainan/i,'台南'],[/kaohsiung/i,'高雄']];
// "台南／新竹" counts for both; "新竹縣竹北市台元一街 9 號" counts once as 新竹
// "XX市 / XX縣" is trusted first, so road names such as 台南市中和路 or 永康街 don't add a second city
function cities(s){
  const t=String(s||'').replace(/臺/g,'台'), out=new Set();
  if(!t.trim())return [];
  CITY_NAMES.forEach(c=>{if(new RegExp(c+'[市縣]').test(t))out.add(c)});
  if(!out.size)CITY_NAMES.forEach(c=>{if(t.includes(c))out.add(c)});
  if(!out.size)Object.entries(AREA_CITY).forEach(([a,c])=>{if(t.includes(a))out.add(c)});
  EN_CITY.forEach(([re,c])=>{if(re.test(t))out.add(c)});
  if(/遠端|remote|wfh/i.test(t))out.add('遠端');
  return out.size?[...out]:['其他'];
}
// skip: leave one filter out, so a menu can count what each of its options would give
function passPanel(d,skip){
  if(skip!=='co'&&F.co&&normKey(d.company)!==F.co)return false;
  if(skip!=='cat'&&F.cat&&(F.cat==='__none'?!!d.category:d.category!==F.cat))return false;
  if(skip!=='ch'&&F.ch&&(F.ch==='__none'?!!d.channel:d.channel!==F.ch))return false;
  if(skip!=='loc'&&F.loc&&!cities(d.location).includes(F.loc))return false;
  if(skip!=='date'&&(F.from||F.to)&&(!d.date||(F.from&&d.date<F.from)||(F.to&&d.date>F.to)))return false;
  return true;
}
const panelN=()=>Object.values(F).filter(Boolean).length;
