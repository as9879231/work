/* ---------- Download helper ---------- */
function downloadBlob(name,blob){
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),4000);
}

/* ---------- XLSX writer (stored zip, inline strings) ---------- */
const CRC_T=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
function crc32(u8){let c=0xFFFFFFFF;for(let i=0;i<u8.length;i++)c=CRC_T[(c^u8[i])&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0}
function zipStore(files){
  const enc=new TextEncoder(), parts=[], central=[];let offset=0;
  files.forEach(({name,content})=>{
    const nb=enc.encode(name), db=enc.encode(content), crc=crc32(db);
    const lh=new DataView(new ArrayBuffer(30));
    lh.setUint32(0,0x04034b50,true);lh.setUint16(4,20,true);lh.setUint16(6,0x0800,true);lh.setUint16(8,0,true);
    lh.setUint16(10,0,true);lh.setUint16(12,0x21,true);lh.setUint32(14,crc,true);lh.setUint32(18,db.length,true);
    lh.setUint32(22,db.length,true);lh.setUint16(26,nb.length,true);lh.setUint16(28,0,true);
    parts.push(new Uint8Array(lh.buffer),nb,db);
    const ch=new DataView(new ArrayBuffer(46));
    ch.setUint32(0,0x02014b50,true);ch.setUint16(4,20,true);ch.setUint16(6,20,true);ch.setUint16(8,0x0800,true);
    ch.setUint16(10,0,true);ch.setUint16(12,0,true);ch.setUint16(14,0x21,true);ch.setUint32(16,crc,true);
    ch.setUint32(20,db.length,true);ch.setUint32(24,db.length,true);ch.setUint16(28,nb.length,true);
    ch.setUint32(42,offset,true);
    central.push(new Uint8Array(ch.buffer),nb);
    offset+=30+nb.length+db.length;
  });
  const cdSize=central.reduce((s,p)=>s+p.length,0);
  const eo=new DataView(new ArrayBuffer(22));
  eo.setUint32(0,0x06054b50,true);eo.setUint16(8,files.length,true);eo.setUint16(10,files.length,true);
  eo.setUint32(12,cdSize,true);eo.setUint32(16,offset,true);
  return new Blob([...parts,...central,new Uint8Array(eo.buffer)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
const xesc=s=>String(s??'').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g,'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const colName=i=>{let s='';i++;while(i){const m=(i-1)%26;s=String.fromCharCode(65+m)+s;i=Math.floor((i-1)/26)}return s};
function sheetXML(rows,widths,wrapCols=[]){
  const cols=widths.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join('');
  const body=rows.map((r,ri)=>`<row r="${ri+1}">`+r.map((v,ci)=>{
    const s=ri===0?' s="1"':wrapCols.includes(ci)?' s="2"':'';
    return `<c r="${colName(ci)}${ri+1}" t="inlineStr"${s}><is><t xml:space="preserve">${xesc(v)}</t></is></c>`}).join('')+'</row>').join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${cols}</cols><sheetData>${body}</sheetData></worksheet>`;
}
function buildXlsx(sheets){
  const NS='http://schemas.openxmlformats.org/spreadsheetml/2006/main', R='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const files=[
    {name:'[Content_Types].xml',content:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((s,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`},
    {name:'_rels/.rels',content:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${R}/officeDocument" Target="xl/workbook.xml"/></Relationships>`},
    {name:'xl/workbook.xml',content:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="${NS}" xmlns:r="${R}"><sheets>${sheets.map((s,i)=>`<sheet name="${xesc(s.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`},
    {name:'xl/_rels/workbook.xml.rels',content:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((s,i)=>`<Relationship Id="rId${i+1}" Type="${R}/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length+1}" Type="${R}/styles" Target="styles.xml"/></Relationships>`},
    {name:'xl/styles.xml',content:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="${NS}"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFDFEAE2"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`},
    ...sheets.map((s,i)=>({name:`xl/worksheets/sheet${i+1}.xml`,content:sheetXML(s.rows,s.widths,s.wrap)}))
  ];
  return zipStore(files);
}
// one width per FIELDS entry, plus the trailing 面試紀錄 column
const MAIN_WIDTHS=[18,20,12,10,12,16,10,10,12,14,18,12,30,30,48];
function mainRows(rows){return [[...FIELDS.map(f=>LABELS[f]),'面試紀錄'],...rows.map(d=>[...FIELDS.map(f=>f==='origin'?org(d):f==='status'?st(d.status).k:(d[f]||'')),(d.interviews||[]).map(ivText).join('；')])]}
function ivRows(rows){
  const out=[['公司','職位','輪次','日期時間','形式','結果','筆記']];
  rows.forEach(d=>(d.interviews||[]).forEach(iv=>out.push([d.company,d.position,iv.round,fmtDT(iv.when),iv.mode,iv.result,iv.note])));
  return out;
}
function exportRows(rows,tag){
  if(!rows.length){toast('目前沒有資料可以匯出');return false}
  const blob=buildXlsx([
    {name:'投遞紀錄',rows:mainRows(rows),widths:MAIN_WIDTHS,wrap:[FIELDS.indexOf('note'),FIELDS.length]},
    {name:'面試紀錄',rows:ivRows(rows),widths:[18,20,10,18,8,10,40],wrap:[6]}
  ]);
  downloadBlob(`求職投遞紀錄${tag?'_'+tag:''}_${todayStr()}.xlsx`,blob);
  if(!tag)localStorage.setItem(KEY+'-lastExport',Date.now());
  return true;
}

/* ---------- Calendar (.ics) ---------- */
function icsEsc(s){return String(s||'').replace(/\\/g,'\\\\').replace(/[,;]/g,m=>'\\'+m).replace(/\r?\n/g,'\\n')}
function icsDT(s){return s.replace(/[-:]/g,'').slice(0,13)+'00'}
function icsEvent(d,iv){
  const allDay=!hasTime(iv.when), s0=ivStart(iv.when);
  let startL,endL;
  if(allDay){
    const e=new Date(s0);e.setDate(e.getDate()+1);
    startL=`DTSTART;VALUE=DATE:${ymd(s0).replace(/-/g,'')}`;endL=`DTEND;VALUE=DATE:${ymd(e).replace(/-/g,'')}`;
  }else{
    const end=new Date(s0.getTime()+36e5);
    startL=`DTSTART:${icsDT(iv.when)}`;endL=`DTEND:${icsDT(`${ymd(end)}T${pad(end.getHours())}:${pad(end.getMinutes())}`)}`;
  }
  const now=new Date().toISOString().replace(/[-:]/g,'').slice(0,15)+'Z';
  const desc=[d.position&&`職位：${d.position}`,d.contact&&`聯絡人：${d.contact}`,iv.note&&`筆記：${iv.note}`,allDay&&'時間未定',d.link].filter(Boolean).join('\n');
  return ['BEGIN:VEVENT',`UID:${d.id}-${iv.when.replace(/\D/g,'')}@job-log`,`DTSTAMP:${now}`,startL,endL,
    `SUMMARY:${icsEsc(`【面試】${d.company} ${iv.round}`)}`,`LOCATION:${icsEsc([iv.mode,d.location].filter(Boolean).join(' · '))}`,
    `DESCRIPTION:${icsEsc(desc)}`,'BEGIN:VALARM',`TRIGGER:${allDay?'-PT15H':'-PT1H'}`,'ACTION:DISPLAY',`DESCRIPTION:${icsEsc(d.company+' '+iv.round)}`,'END:VALARM','END:VEVENT'].join('\r\n');
}
function downloadICS(pairs,name){
  pairs=pairs.filter(p=>p.iv.when);
  if(!pairs.length){toast('沒有排定時間的面試');return}
  const body=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//JobLog//ZH-TW','CALSCALE:GREGORIAN',...pairs.map(p=>icsEvent(p.d,p.iv)),'END:VCALENDAR'].join('\r\n');
  downloadBlob(name,new Blob([body],{type:'text/calendar;charset=utf-8'}));
  toast(`已下載 ${pairs.length} 場面試，打開檔案即可加入行事曆`);
}

/* ---------- Import ---------- */
function parseCSV(t){
  t=t.replace(/^﻿/,'');// Excel's CSV starts with a BOM
  t=t.replace(/^﻿/,'');t=t.replace(/^﻿/,'');const rows=[];let r=[],c='',q=false;
  for(let i=0;i<t.length;i++){const ch=t[i];
    if(q){if(ch==='"'){if(t[i+1]==='"'){c+='"';i++}else q=false}else c+=ch}
    else if(ch==='"')q=true;else if(ch===','){r.push(c);c=''}
    else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&t[i+1]==='\n')i++;r.push(c);rows.push(r);r=[];c=''}
    else c+=ch}
  if(c||r.length){r.push(c);rows.push(r)}
  return rows;
}
async function unzip(buf){
  const dv=new DataView(buf), u8=new Uint8Array(buf), dec=new TextDecoder();
  let e=buf.byteLength-22;while(e>=0&&dv.getUint32(e,true)!==0x06054b50)e--;
  if(e<0)throw new Error('不是有效的 .xlsx 檔');
  const count=dv.getUint16(e+10,true);let p=dv.getUint32(e+16,true);const out={};
  for(let i=0;i<count;i++){
    const method=dv.getUint16(p+10,true), csize=dv.getUint32(p+20,true), nl=dv.getUint16(p+28,true), xl=dv.getUint16(p+30,true), cl=dv.getUint16(p+32,true), lo=dv.getUint32(p+42,true);
    const name=dec.decode(u8.subarray(p+46,p+46+nl));p+=46+nl+xl+cl;
    if(!/^xl\/(sharedStrings|workbook|worksheets\/|_rels\/workbook)/.test(name))continue;
    const start=lo+30+dv.getUint16(lo+26,true)+dv.getUint16(lo+28,true);
    const raw=u8.subarray(start,start+csize);
    out[name]=method===0?dec.decode(raw):await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
  }
  return out;
}
async function parseXLSX(buf){
  const files=await unzip(buf);
  const xml=s=>new DOMParser().parseFromString(s,'application/xml');
  const shared=files['xl/sharedStrings.xml']?[...xml(files['xl/sharedStrings.xml']).getElementsByTagName('si')].map(si=>[...si.getElementsByTagName('t')].map(t=>t.textContent).join('')):[];
  let sheetPath='xl/worksheets/sheet1.xml';
  if(files['xl/workbook.xml']&&files['xl/_rels/workbook.xml.rels']){
    const first=xml(files['xl/workbook.xml']).getElementsByTagName('sheet')[0];
    const rid=first&&(first.getAttribute('r:id')||first.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id'));
    const rel=[...xml(files['xl/_rels/workbook.xml.rels']).getElementsByTagName('Relationship')].find(r=>r.getAttribute('Id')===rid);
    if(rel){const t=rel.getAttribute('Target').replace(/^\//,'');sheetPath=t.startsWith('xl/')?t:'xl/'+t}
  }
  if(!files[sheetPath])sheetPath=Object.keys(files).find(k=>/^xl\/worksheets\/.*\.xml$/.test(k));
  const doc=xml(files[sheetPath]);const out=[];
  const colIdx=ref=>{const L=ref.match(/^[A-Z]+/)[0];let n=0;for(const ch of L)n=n*26+ch.charCodeAt(0)-64;return n-1};
  [...doc.getElementsByTagName('row')].forEach(row=>{
    const r=+row.getAttribute('r')-1, arr=[];
    [...row.getElementsByTagName('c')].forEach(c=>{
      const t=c.getAttribute('t'), v=c.getElementsByTagName('v')[0], ref=c.getAttribute('r');
      let val='';
      if(t==='s')val=shared[+v?.textContent]??'';
      else if(t==='inlineStr')val=[...c.getElementsByTagName('t')].map(x=>x.textContent).join('');
      else if(v){val=v.textContent;if(t!=='str'&&t!=='b'&&t!=='e'&&!isNaN(val))val=+val}
      arr[ref?colIdx(ref):arr.length]=val;
    });
    out[r]=arr;
  });
  return out.filter(Boolean).map(r=>Array.from(r,x=>x??''));
}
function rowsToRecords(rows){
  rows=rows.filter(r=>r&&r.some(c=>String(c??'').trim()!==''));
  if(rows.length<2)throw new Error('檔案裡沒有找到資料');
  const head=rows[0].map(h=>String(h??'').trim().toLowerCase());
  const map={};
  FIELDS.forEach(f=>{const i=head.findIndex(h=>ALIASES[f].includes(h));if(i>-1)map[f]=i});
  FIELDS.forEach(f=>{if(map[f]===undefined){const i=head.findIndex((h,idx)=>!Object.values(map).includes(idx)&&ALIASES[f].some(a=>a.length>1&&h.includes(a)));if(i>-1)map[f]=i}});
  if(map.company===undefined&&map.position===undefined)throw new Error('找不到「公司」或「職位」欄位，請確認第一列是欄位名稱。');
  const used=new Set(Object.values(map));
  const ivLog=head.findIndex(h=>['面試紀錄','面試記錄','interviews','interview log'].includes(h));
  // columns like 一面 / 二面日期 / 面試日期 become interview rounds
  const ivCols=head.map((h,i)=>{if(used.has(i)||i===ivLog)return null;
    const m=h.match(/^(一|二|三|四|五|終|主管|hr)\s*面/i);if(m)return {i,round:m[1].toUpperCase()==='HR'?'HR面':m[1]+'面'};
    if(/^(面試日期|面試時間|interview date|interview)$/.test(h))return {i,round:'一面'};
    if(/筆試|測驗/.test(h))return {i,round:'筆試/測驗'};return null}).filter(Boolean);
  return rows.slice(1).map(r=>{const o={id:uid()};FIELDS.forEach(f=>o[f]=map[f]!==undefined?String(r[map[f]]??'').trim():'');
    o.date=normDate(map.date!==undefined?r[map.date]:'');o.nextDate=normDate(map.nextDate!==undefined?r[map.nextDate]:'');
    o.interviews=ivLog>-1?parseIvText(r[ivLog]):[];
    ivCols.forEach(c=>{const v=r[c.i];if(v===''||v==null)return;const when=normDT(v);
      o.interviews.push({round:c.round,when,mode:'',result:isFuture(when)?'待面試':'等結果',note:when?'':String(v)})});
    const rm=String(o.status).match(/(一|二|三|四|終|主管|HR)面/i);
    if(rm&&!o.interviews.length)o.interviews.push({round:rm[0],when:'',mode:'',result:'待面試',note:''});
    // the backup's status is trusted as-is; it is only derived when the column is blank
    const rawStatus=o.status;o.status=rawStatus?normStatus(rawStatus):'';
    o.origin=(map.origin!==undefined&&o.origin)||normOrigin(o.channel)==='公司邀約'?normOrigin(o.origin||o.channel):'';
    return o}).filter(o=>o.company||o.position);
}
// the Excel file is the source of truth: importing replaces everything, one record per row.
// rows are never merged — two records with the same company, position and date are both real
// (e.g. the same job applied to through two channels), and merging them lost one on restore
function importRecords(incoming){
  if(data.length&&!confirm(`要從這個備份還原嗎？\n\n網頁上現有的 ${data.length} 筆紀錄，會換成備份檔裡的 ${incoming.length} 筆。\n（還原後 10 秒內可以按「復原」）`))return;
  snapshot();
  data=incoming.map(o=>normalizeRecord(fillDefaults(o)));
  unifyCats();
  finishImport(`已從備份還原 ${data.length} 筆`);
}
function finishImport(msg){save();filter=null;attnOnly=false;Object.keys(F).forEach(k=>F[k]='');page=1;selected.clear();setSelMode(false);render();toast(msg,{undo:true})}
