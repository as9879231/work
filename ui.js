/* ---------- Edit dialog ---------- */
$('#statusSel').innerHTML=STATUSES.map(s=>`<option>${s.k}</option>`).join('');
const opts=(list,v)=>list.map(x=>`<option ${x===v?'selected':''}>${x}</option>`).join('');
function ivRowHTML(iv){
  const rounds=ROUNDS.includes(iv.round)||!iv.round?ROUNDS:[iv.round,...ROUNDS];
  return `<div class="iv-row">
    <select data-k="round">${opts(rounds,iv.round)}</select>
    <input type="date" data-k="d" value="${esc((iv.when||'').slice(0,10))}">
    <input type="time" data-k="t" value="${esc(hasTime(iv.when)?iv.when.slice(11,16):'')}" title="時間不確定可以留空">
    <select data-k="mode"><option value="">形式</option>${opts(MODES,iv.mode)}</select>
    <select data-k="result">${opts(RESULTS,iv.result||'待面試')}</select>
    <input data-k="note" placeholder="面試官、考題、心得…" value="${esc(iv.note||'')}">
    <button type="button" class="ic cal" title="下載這場面試的行事曆檔">📅</button>
    <button type="button" class="ic rm" title="移除這輪">✕</button>
  </div>`;
}
function renderIvList(list){
  $('#ivList').innerHTML=list.length?list.map(ivRowHTML).join(''):'<div class="iv-empty">還沒有面試紀錄。收到面試通知時按「新增一輪」。</div>';
  $('#ivList').querySelectorAll('.rm').forEach((b,i)=>b.onclick=()=>{const l=readIvList();l.splice(i,1);renderIvList(l);liveSync()});
  $('#ivList').querySelectorAll('[data-k=result]').forEach(s=>s.onchange=liveSync);
  $('#ivList').querySelectorAll('.cal').forEach((b,i)=>b.onclick=()=>{
    const iv=readIvList()[i], f=$('#form').elements;
    if(!iv.when)return toast('先填這一輪的日期時間');
    const d={id:editingId||'new',company:f.company.value,position:f.position.value,location:f.location.value,contact:f.contact.value,link:f.link.value};
    downloadICS([{d,iv}],`面試_${d.company||'未命名'}_${iv.round}.ics`);
  });
}
function readIvList(){
  return [...$('#ivList').querySelectorAll('.iv-row')].map(r=>{
    const o={};r.querySelectorAll('[data-k]').forEach(el=>o[el.dataset.k]=el.value.trim());
    o.when=o.d?(o.t?`${o.d}T${o.t}`:o.d):'';delete o.d;delete o.t;
    return o;
  });
}
$('#ivAdd').onclick=()=>{
  const l=readIvList(), used=l.map(x=>x.round);
  const nextRound=['一面','二面','三面','四面','終面'].find(r=>!used.includes(r))||'終面';
  l.push({round:nextRound,when:'',mode:'',result:'待面試',note:''});renderIvList(l);liveSync();
  $('#ivList').querySelector('.iv-row:last-child input[type=date]').focus();
};
// keep the status dropdown and the interview results in step while editing
function liveSync(){
  const tmp={status:$('#statusSel').value,interviews:readIvList().filter(x=>x.round||x.when)};
  deriveStatus(tmp);$('#statusSel').value=st(tmp.status).k;
}
$('#statusSel').onchange=()=>{
  const tmp={interviews:readIvList()};
  applyStatusToInterviews(tmp,$('#statusSel').value);renderIvList(tmp.interviews);
};
function syncOrigin(swapStatus){
  const f=$('#form'), inb=f.elements.origin.value==='公司邀約';
  $('#dateLab').textContent=inb?'對方聯繫日期':'投遞日期';
  $('#chLab').textContent=inb?'從哪裡找到我':'投遞管道';
  f.elements.channel.placeholder=inb?'LinkedIn 私訊、獵頭、104 邀約…':'104、LinkedIn、內推…';
  $('#ctLab').textContent=inb?'聯絡人（HR／獵頭）':'聯絡人';
  $('#dlgTitle').classList.toggle('inbound',inb);
  if(!swapStatus)return;
  // flip the default status along with the origin toggle
  const s=f.elements.status;
  if(inb&&s.value==='已投遞')s.value='邀約洽談';
  if(!inb&&s.value==='邀約洽談')s.value='已投遞';
}
document.querySelectorAll('input[name=origin]').forEach(r=>r.onchange=()=>syncOrigin(true));
// typing a company you've already logged fills in its category
$('#form').elements.company.addEventListener('change',()=>{
  const f=$('#form').elements;if(f.category.value)return;
  const k=normKey(f.company.value), m=data.find(d=>d.category&&normKey(d.company)===k);
  if(m)f.category.value=m.category;
});
function openDlg(id,origin){
  editingId=id||null;
  const f=$('#form'), inb=origin==='公司邀約';
  // a new record started while one company is filtered starts with that company filled in
  const pre=!id&&F.co?data.find(x=>normKey(x.company)===F.co):null;
  const d=id?data.find(x=>x.id===id):{date:todayStr(),origin:inb?'公司邀約':'主動投遞',status:inb?'邀約洽談':'已投遞',company:pre?pre.company:'',category:pre?pre.category:(F.cat&&F.cat!=='__none'?F.cat:'')};
  FIELDS.forEach(k=>f.elements[k].value=k==='origin'?org(d):k==='status'?st(d.status).k:(d[k]||''));
  renderIvList((d.interviews||[]).map(x=>({...x})));
  syncOrigin();
  $('#dlgTitle').textContent=id?(org(d)==='公司邀約'?'編輯公司邀約':'編輯投遞'):(inb?'新增公司邀約':'新增投遞');
  $('#delBtn').style.visibility=id?'visible':'hidden';
  $('#dlg').showModal();
}
$('#addBtn').onclick=()=>openDlg();
$('#addInBtn').onclick=()=>openDlg(null,'公司邀約');
$('#cancelBtn').onclick=()=>$('#dlg').close();
$('#delBtn').onclick=()=>{
  const r=data.find(x=>x.id===editingId);snapshot();
  data=data.filter(x=>x.id!==editingId);save();$('#dlg').close();render();toast(`已刪除 ${r?r.company:''}`,{undo:true});
};
$('#form').onsubmit=e=>{
  const f=e.target, o={};FIELDS.forEach(k=>o[k]=f.elements[k].value.trim());
  o.interviews=sortInterviews(readIvList().filter(x=>x.round||x.when));
  // the dropdown already reflects both the live interview sync and any manual pick, so it is final
  applyStatusToInterviews(o,o.status);
  if(!editingId){
    // same company + position counts as a repeat even on a different day
    const same=d=>normKey(d.company)===normKey(o.company)&&normKey(d.position)===normKey(o.position);
    const dup=data.find(d=>same(d)&&d.date===o.date)||data.find(same);
    const msg=dup&&(dup.date===o.date
      ?`已經有一筆一模一樣的「${dup.company}／${dup.position}」（${dup.date||'無日期'}）。`
      :`你在 ${dup.date||'之前'} 已經記過「${dup.company}／${dup.position}」，目前狀態是「${st(dup.status).k}」。`);
    if(dup&&!confirm(`${msg}\n還是要另外新增一筆嗎？`)){e.preventDefault();return}
  }
  snapshot();
  const prev=editingId?(data.find(x=>x.id===editingId).category||''):'';
  const id=editingId||uid();
  if(editingId)Object.assign(data.find(x=>x.id===editingId),o);else data.push({id,...o});
  // the category belongs to the company, so a change here applies to its other records too
  let others=0;
  if(o.category!==prev){const k=normKey(o.company);data.forEach(d=>{if(normKey(d.company)===k&&d.category!==o.category){d.category=o.category;others++}})}
  unifyCats();
  save();
  // filters are remembered now, so say so when the saved record falls outside them instead of seeming to vanish
  const hidden=view!=='stats'&&!getRows(false).some(d=>d.id===id);
  render();
  const msg=others?`已儲存，${o.company} 的另外 ${others} 筆也改成「${o.category||'未分類'}」`:'已儲存';
  toast(hidden?`${msg}（目前的篩選或搜尋看不到這筆）`:msg,{undo:true});
};

/* ---------- Bulk actions ---------- */
$('#bulkStatus').innerHTML+=STATUSES.map(s=>`<option>${s.k}</option>`).join('');
function updateBulk(){
  const n=selected.size, vis=visibleIds.filter(id=>selected.has(id)).length;
  $('#bulk').classList.toggle('show',n>0);document.body.classList.toggle('has-bulk',n>0);
  $('#bulkN').textContent=n;$('#bulkCnt').textContent='筆已選';
  // phones hide the table header, so a second select-all box sits above the cards
  ['#ckAll','#ckAll2'].forEach(s=>{const all=$(s);all.checked=visibleIds.length>0&&vis===visibleIds.length;all.indeterminate=vis>0&&vis<visibleIds.length});
}
['#ckAll','#ckAll2'].forEach(s=>$(s).onchange=e=>{visibleIds.forEach(id=>e.target.checked?selected.add(id):selected.delete(id));render()});
const picked=()=>data.filter(d=>selected.has(d.id));
function bulkDone(msg,undo=true){selected.clear();save();render();toast(msg,{undo})}
let bulkApply=null;
function openBulk(title,body,apply){
  $('#bTitle').textContent=title;$('#bBody').innerHTML=body;bulkApply=apply;
  $('#bdlg').showModal();const first=$('#bBody').querySelector('input,textarea');if(first)first.focus();
}
$('#bCancel').onclick=()=>$('#bdlg').close();
$('#bform').onsubmit=()=>{const el=$('#bform').elements;snapshot();bulkApply(el)};
$('#bulkStatus').onchange=e=>{
  const v=e.target.value;e.target.value='';if(!v)return;
  const n=selected.size;snapshot();picked().forEach(d=>{applyStatusToInterviews(d,v);d.status=v});bulkDone(`${n} 筆 → ${v}`);
};
$('#bulkCat').onclick=()=>openBulk(`設定 ${selected.size} 筆的公司類別`,
  `<label>公司類別<input name="ct" list="catList" placeholder="例：IC設計、封測、第一梯隊"></label><p class="sub" style="margin:0">同一間公司的其他紀錄也會一起改。留空就是清除類別。</p>`,
  el=>{const v=el.ct.value.trim(), ks=new Set(picked().map(d=>normKey(d.company)));
    data.forEach(d=>{if(ks.has(normKey(d.company)))d.category=v});
    bulkDone(v?`${ks.size} 間公司 → ${v}`:`已清除 ${ks.size} 間公司的類別`)});
$('#bulkChannel').onclick=()=>openBulk(`改 ${selected.size} 筆的管道`,
  `<label>管道<input name="ch" list="channels" placeholder="104、LinkedIn、內推…"></label>`,
  el=>{picked().forEach(d=>d.channel=el.ch.value.trim());bulkDone('已更新管道')});
$('#bulkNext').onclick=()=>openBulk(`設定 ${selected.size} 筆的下一步`,
  `<label>下一步<input name="nx" placeholder="例：寄感謝信、追蹤進度"></label><label>日期（可留空）<input type="date" name="nd" value="${todayStr()}"></label>`,
  el=>{picked().forEach(d=>{d.next=el.nx.value.trim();d.nextDate=el.nd.value});bulkDone('已設定下一步')});
$('#bulkNote').onclick=()=>openBulk(`在 ${selected.size} 筆的備註後面加上`,
  `<label>要加的文字<textarea name="nt" placeholder="原本的備註會保留，這段會加在後面"></textarea></label>`,
  el=>{const v=el.nt.value.trim();if(!v)return;picked().forEach(d=>d.note=d.note?`${d.note}\n${v}`:v);bulkDone('已加上備註')});
$('#bulkExport').onclick=()=>{if(exportRows(picked(),'選取'))bulkDone('已匯出選取的紀錄',false)};
$('#bulkDel').onclick=()=>{
  const n=selected.size;snapshot();data=data.filter(d=>!selected.has(d.id));bulkDone(`已刪除 ${n} 筆`);
};
$('#bulkClear').onclick=()=>{selected.clear();render()};
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&selected.size&&!$('#dlg').open&&!$('#bdlg').open){selected.clear();render()}});

/* ---------- Toolbar, filter row, sorting, views ---------- */
$('#q').oninput=()=>{$('#qClr').hidden=!$('#q').value;page=1;render()};
$('#qClr').onclick=()=>{$('#q').value='';$('#qClr').hidden=true;page=1;render();$('#q').focus()};
$('#q').onkeydown=e=>{if(e.key==='Escape'&&$('#q').value){e.stopPropagation();$('#qClr').click()}};
$('#originF').onchange=()=>{page=1;render()};
// phones hide the filter row behind this button; the source picker and the grouping toggle move into it there
$('#fToggle').onclick=()=>document.body.classList.toggle('f-open');
function placeForPhone(){
  const f=$('#filters'), tb=$('.toolbar'), bar=$('.tbl-bar');
  if(PHONE.matches){f.insertBefore($('#originF'),$('#fCo'));f.appendChild($('#grpTgl'))}
  else{tb.insertBefore($('#originF'),$('#fToggle'));bar.appendChild($('#grpTgl'))}
}
placeForPhone();PHONE.addEventListener('change',placeForPhone);
function setFilter(k,v){F[k]=v;page=1;render()}
Object.entries({co:'#fCo',cat:'#fCat',ch:'#fCh',loc:'#fLoc',from:'#fFrom',to:'#fTo'}).forEach(([k,s])=>$(s).onchange=()=>setFilter(k,$(s).value));
$('#fClear').onclick=()=>{Object.keys(F).forEach(k=>F[k]='');page=1;render()};
$('#grpCo').onchange=e=>{groupCo=e.target.checked;localStorage.setItem(KEY+'-group',groupCo?'1':'');page=1;render()};
$('#anF').onchange=e=>{anFiltered=e.target.checked;localStorage.setItem(KEY+'-anf',anFiltered?'1':'');render()};
$('#sortSel').onchange=e=>{sortKey=e.target.value;sortDir=sortKey==='date'?-1:1;page=1;render()};
$('#sortDirBtn').onclick=()=>{sortDir=-sortDir;page=1;render()};

/* ---------- "No reply" suggestion ---------- */
$('#suggApply').onclick=()=>{
  const a=data.filter(ghost), b=data.filter(ivGhost);if(!a.length&&!b.length)return;
  snapshot();
  a.forEach(d=>d.status='無回應');
  b.forEach(d=>{applyStatusToInterviews(d,'未錄取');d.status='未錄取'});
  save();ghostOnly=false;render();
  toast([a.length&&`${a.length} 筆改成無回應`,b.length&&`${b.length} 筆改成未錄取`].filter(Boolean).join('、'),{undo:true});
};
$('#suggView').onclick=()=>{ghostOnly=true;filter=null;attnOnly=false;view='table';localStorage.setItem(KEY+'-view',view);selected.clear();page=1;render()};
$('#suggLater').onclick=()=>{localStorage.setItem(KEY+'-ghostSnooze',Date.now()+3*864e5);renderSuggest()};

/* ---------- Offer comparison ---------- */
function openCompare(){
  const offers=data.filter(d=>st(d.status).k==='錄取');
  if(!offers.length)return toast('目前還沒有錄取的紀錄');
  const rowsDef=[
    ['職位',d=>esc(d.position)],
    ...(SHOW_CAT?[['類別',d=>esc(d.category||'—')]]:[]),
    ['薪資',d=>d.salary?`<span class="money">${esc(d.salary)}</span>`:'<span class="sub">未填</span>'],
    ['地點',d=>esc(d.location||'—')],
    ['來源',d=>`${org(d)}${d.channel?'<br><span class="sub">'+esc(d.channel)+'</span>':''}`],
    ['面試過程',d=>(d.interviews||[]).length?(d.interviews||[]).map(x=>`${esc(x.round)}${x.result?' · '+esc(x.result):''}`).join('<br>'):'—'],
    ['聯絡人',d=>esc(d.contact||'—')],
    ['下一步',d=>esc(d.next||'—')+(d.nextDate?`<br><span class="sub">${esc(d.nextDate)}</span>`:'')],
    ['備註',d=>esc(d.note||'—')],
    ['連結',d=>d.link?`<a href="${esc(d.link)}" target="_blank" rel="noopener">職缺頁面 ↗</a>`:'—']
  ];
  $('#cmpBody').innerHTML=`<table class="cmp"><thead><tr><th></th>${offers.map(d=>`<th><a href="#" data-cmp="${d.id}" style="color:inherit">${esc(d.company)}</a></th>`).join('')}</tr></thead>
    <tbody>${rowsDef.map(([l,f])=>`<tr><th>${l}</th>${offers.map(d=>`<td>${f(d)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  $('#cmpBody').querySelectorAll('[data-cmp]').forEach(a=>a.onclick=e=>{e.preventDefault();$('#cdlg').close();openDlg(a.dataset.cmp)});
  $('#cdlg').showModal();
}
document.querySelectorAll('th[data-sort]').forEach(th=>th.onclick=()=>{
  const k=th.dataset.sort;
  if(sortKey===k)sortDir=-sortDir;else{sortKey=k;sortDir=k==='date'?-1:1}
  page=1;render();
});
document.querySelectorAll('#views button').forEach(b=>b.onclick=()=>{view=b.dataset.v;localStorage.setItem(KEY+'-view',view);selected.clear();render()});
view=localStorage.getItem(KEY+'-view')||'table';

/* ---------- Import / export / backup ---------- */
$('#exportBtn').onclick=()=>{if(exportRows(data)){toast('已備份到 Excel，記得把檔案存在安全的地方');renderBackup()}};
$('#backupNow').onclick=()=>{if(exportRows(data)){renderBackup();toast('備份完成')}};
$('#backupLater').onclick=()=>{localStorage.setItem(KEY+'-snooze',Date.now()+864e5);renderBackup()};
$('#fileIn').onchange=async e=>{
  const file=e.target.files[0];e.target.value='';if(!file)return;
  try{
    const rows=file.name.toLowerCase().endsWith('.csv')?parseCSV(await file.text()):await parseXLSX(await file.arrayBuffer());
    importRecords(rowsToRecords(rows));
  }catch(err){console.error(err);alert('還原失敗：'+err.message+'\n請選擇用「備份到 Excel」存下來的 .xlsx 檔。')}
};

// bring saved records in line with the status/interview rules
data.forEach(normalizeRecord);unifyCats();save();
if(!SHOW_CAT)['#fCat','#bulkCat'].forEach(s=>$(s).hidden=true),$('#form').elements.category.closest('label').hidden=true;
// bring back the last filter row, search and source; values that no longer exist are dropped by renderFilters
try{
  const sv=JSON.parse(localStorage.getItem(KEY+'-filters')||'{}');
  Object.keys(F).forEach(k=>{if(sv.F&&typeof sv.F[k]==='string')F[k]=sv.F[k]});
  $('#q').value=sv.q||'';$('#qClr').hidden=!$('#q').value;
  if(['主動投遞','公司邀約'].includes(sv.of))$('#originF').value=sv.of;
}catch(e){}
render();
