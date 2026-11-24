/* ---------- Filtering & sorting ---------- */
function matches(d,q){
  return FIELDS.some(f=>String(d[f]||'').toLowerCase().includes(q))||(d.interviews||[]).some(iv=>ivText(iv).toLowerCase().includes(q));
}
// everything outside the filter row that narrows the list: status card, alerts, source, search
function otherPass(d){
  const q=$('#q').value.trim().toLowerCase(), of=$('#originF').value;
  return (!filter||filter==='ALL'||st(d.status).k===filter)&&(!attnOnly||attention(d).length)&&(!ghostOnly||ghost(d)||ivGhost(d))&&(!of||org(d)===of)&&(!q||matches(d,q));
}
// default (no card picked) = 進行中: closed records stay hidden unless 全部 or a status card is picked
const hidesClosed=keep=>!keep&&!filter&&!ghostOnly;
function getRows(keepClosed){
  const base=data.filter(d=>passPanel(d)&&otherPass(d));
  const rows=hidesClosed(keepClosed)?base.filter(d=>!CLOSED.includes(st(d.status).k)):base;
  hiddenClosed=base.length-rows.length;
  const val={
    company:d=>d.company||'', channel:d=>d.channel||'', date:d=>d.date||'',
    status:d=>STATUSES.indexOf(st(d.status)), nextDate:d=>d.nextDate||((nextInterview(d)||{}).when||'').slice(0,10),
    interview:d=>{const c=currentInterview(d);return c&&c.when||''}
  }[sortKey];
  rows.sort((a,b)=>{
    const x=val(a), y=val(b);
    if(typeof x==='string'){if(!x&&y)return 1;if(x&&!y)return -1;return x.localeCompare(y,'zh-Hant')*sortDir}
    return (x-y)*sortDir;
  });
  return rows;
}

/* ---------- Filter row ---------- */
function fillSel(sel,ph,items,cur){
  const el=$(sel);
  if(cur&&!items.some(x=>x.v===cur))items=[{v:cur,l:cur==='__none'?'（無）':cur,n:0},...items];
  // options that would leave nothing are greyed out, except the one already picked
  el.innerHTML=`<option value="">${ph}</option>`+items.map(x=>`<option value="${esc(x.v)}" ${x.n===0&&x.v!==cur?'disabled':''}>${esc(x.l)}</option>`).join('');
  el.value=cur;el.classList.toggle('on',!!cur);
}
function renderFilters(){
  // every value that exists at all, so a remembered pick can be checked and kept
  const co=new Map(), cat=new Set(), ch=new Set(), loc=new Set();let anyNoCat=false, anyNoCh=false;
  data.forEach(d=>{
    if(d.company&&!co.has(normKey(d.company)))co.set(normKey(d.company),d.company);
    d.category?cat.add(d.category):anyNoCat=true;
    d.channel?ch.add(d.channel):anyNoCh=true;
    cities(d.location).forEach(c=>loc.add(c));
  });
  // a picked value can vanish after a delete, rename or undo; drop it instead of showing an empty table
  if(F.co&&!co.has(F.co))F.co='';
  if(F.ch&&!(F.ch==='__none'?anyNoCh:ch.has(F.ch)))F.ch='';
  if(F.loc&&!loc.has(F.loc))F.loc='';
  if(F.cat&&!SHOW_CAT)F.cat='';
  // each menu counts what its options would show, given every OTHER active condition
  // (the other menus, status card, source, search, and the hidden closed records)
  const inView=view==='stats'?()=>true:d=>otherPass(d)&&!(hidesClosed(false)&&CLOSED.includes(st(d.status).k));
  const tally=(k,keysOf)=>{const m=new Map();let total=0;
    data.forEach(d=>{if(!inView(d)||!passPanel(d,k))return;total++;keysOf(d).forEach(v=>m.set(v,(m.get(v)||0)+1))});
    m.total=total;return m};
  const nCo=tally('co',d=>d.company?[normKey(d.company)]:[]), nCat=tally('cat',d=>[d.category||'__none']),
        nCh=tally('ch',d=>[d.channel||'__none']), nLoc=tally('loc',d=>[...new Set(cities(d.location))]);
  const opt=(v,l,m)=>{const n=m.get(v)||0;return {v,l:`${l}（${n}）`,n,name:l}};
  const order=(a,b)=>b.n-a.n||a.name.localeCompare(b.name,'zh-Hant');
  fillSel('#fCo',`全部公司（${nCo.total}）`,[...co].map(([k,name])=>opt(k,name,nCo)).sort(order),F.co);
  fillSel('#fCat',`全部類別（${nCat.total}）`,[...[...cat].map(k=>opt(k,k,nCat)).sort(order),...(anyNoCat&&cat.size?[opt('__none','未分類',nCat)]:[])],F.cat);
  fillSel('#fCh',`全部管道（${nCh.total}）`,[...[...ch].map(k=>opt(k,k,nCh)).sort(order),...(anyNoCh&&ch.size?[opt('__none','未填管道',nCh)]:[])],F.ch);
  fillSel('#fLoc',`全部地點（${nLoc.total}）`,[...loc].map(k=>opt(k,k==='其他'?'其他／未辨識':k,nLoc)).sort((a,b)=>(a.v==='其他')-(b.v==='其他')||order(a,b)),F.loc);
  $('#fFrom').value=F.from;$('#fTo').value=F.to;
  $('#fFrom').classList.toggle('on',!!F.from);$('#fTo').classList.toggle('on',!!F.to);
  $('#fTo').min=F.from;$('#fFrom').max=F.to;
  const n=panelN();$('#fClear').hidden=!n;$('#fN').textContent=n;
  $('#fTogN').textContent=n?` · ${n}`:'';$('#fToggle').classList.toggle('on',!!n);
  $('#grpTgl').hidden=view!=='table';$('#grpCo').checked=groupCo;
  $('#sortSel').value=sortKey;$('#sortDirBtn').textContent=sortDir===1?'↑':'↓';
  $('.sort-pick').hidden=view!=='table';
  $('#coList').innerHTML=[...co.values()].map(name=>`<option value="${esc(name)}">`).join('');
  $('#catList').innerHTML=[...cat.keys()].map(k=>`<option value="${esc(k)}">`).join('');
}

/* ---------- Header widgets ---------- */
function renderStats(){
  // the cards always count every record, so the numbers stay put while filtering
  const base=data;
  const counts=Object.fromEntries(STATUSES.map(s=>[s.k,0]));
  base.forEach(d=>counts[st(d.status).k]++);
  const open=base.filter(d=>!CLOSED.includes(st(d.status).k)).length, inv=base.filter(d=>org(d)==='公司邀約').length;
  $('#stats').innerHTML=`<div class="stat ${!filter?'on':''}" data-f=""><div class="n">${open}</div><div class="l">進行中</div></div>`+
    `<div class="stat ${filter==='ALL'?'on':''}" data-f="ALL"><div class="n">${base.length}</div><div class="l">全部${inv?` · 邀約 ${inv}`:''}</div></div>`+
    STATUSES.map(s=>`<div class="stat ${filter===s.k?'on':''}" data-f="${s.k}"><div class="n" style="color:${s.c}">${counts[s.k]}</div><div class="l"><span class="dot" style="background:${s.c}"></span>${s.k}</div></div>`).join('');
  $('#bar').innerHTML=base.length?STATUSES.filter(s=>counts[s.k]).map(s=>`<div data-tip="${s.k}：${counts[s.k]} 筆" style="width:${counts[s.k]/base.length*100}%;background:${s.c}"></div>`).join(''):'';
  // picking a status card clears the special one-off filters so they can't silently combine
  document.querySelectorAll('.stat').forEach(el=>el.onclick=()=>{filter=el.dataset.f||null;ghostOnly=false;attnOnly=false;page=1;render()});
}
function upcomingPairs(days){
  const lim=days?new Date(Date.now()+days*864e5):null, out=[];
  data.forEach(d=>(d.interviews||[]).forEach(iv=>{if(!isFuture(iv.when))return;const t=ivStart(iv.when);if(!lim||t<lim)out.push({d,iv,t})}));
  return out.sort((a,b)=>a.t-b.t);
}
function renderUpcoming(){
  const items=upcomingPairs(14), attnN=data.filter(d=>attention(d).length).length, allFuture=upcomingPairs(0).length;
  const offers=data.filter(d=>st(d.status).k==='錄取').length;
  let html='';
  if(ghostOnly)html+=`<span class="chip ghost" id="ghostChip">📭 只顯示很久沒消息的紀錄（點擊取消）</span>`;
  if(attnN)html+=`<span class="chip attn ${attnOnly?'on':''}" id="attnChip">⚠ ${attnN} 筆待處理${attnOnly?'（顯示中，點擊取消）':''}</span>`;
  if(offers)html+=`<span class="chip offer" id="cmpChip">🎉 ${offers} 個錄取${offers>1?' · 並排比較':' · 查看'}</span>`;
  if(items.length)html+=`<span class="lab">未來兩週面試</span>`+items.map(x=>`<span class="chip" data-open="${x.d.id}"><b>${x.t.getMonth()+1}/${x.t.getDate()}（${WD[x.t.getDay()]}）${hasTime(x.iv.when)?x.iv.when.slice(11,16):'時間未定'}</b>${esc(x.d.company)} ${esc(x.iv.round)}${x.iv.mode?' · '+esc(x.iv.mode):''}</span>`).join('');
  if(allFuture)html+=`<span class="chip ics" id="icsAll">📅 全部面試加入行事曆（${allFuture} 場）</span>`;
  $('#upcoming').innerHTML=html;
  $('#upcoming').querySelectorAll('[data-open]').forEach(el=>el.onclick=()=>openDlg(el.dataset.open));
  const a=$('#attnChip');if(a)a.onclick=()=>{attnOnly=!attnOnly;if(attnOnly){filter=null;ghostOnly=false}page=1;render()};
  const g=$('#ghostChip');if(g)g.onclick=()=>{ghostOnly=false;page=1;render()};
  const c=$('#cmpChip');if(c)c.onclick=openCompare;
  const i=$('#icsAll');if(i)i.onclick=()=>downloadICS(upcomingPairs(0),`面試行事曆_${todayStr()}.ics`);
}
function renderSuggest(){
  const a=data.filter(ghost).length, b=data.filter(ivGhost).length, snooze=+localStorage.getItem(KEY+'-ghostSnooze')||0;
  $('#sugg').classList.toggle('show',a+b>0&&Date.now()>snooze&&!ghostOnly);
  const parts=[];
  if(a)parts.push(`<b>${a}</b> 筆投遞超過 30 天都沒消息（建議改成「無回應」）`);
  if(b)parts.push(`<b>${b}</b> 筆面試完超過 14 天還沒有結果（建議改成「未錄取」）`);
  $('#suggMsg').innerHTML=`有 ${parts.join('，')}。`;
  $('#suggApply').textContent=a&&b?'全部照建議修改':a?'全部改成無回應':'全部改成未錄取';
}
function renderBackup(){
  const last=+localStorage.getItem(KEY+'-lastExport')||0, snooze=+localStorage.getItem(KEY+'-snooze')||0;
  const days=last?Math.floor((Date.now()-last)/864e5):null;
  const show=data.length>0&&Date.now()>snooze&&(days===null||days>=7);
  $('#backup').classList.toggle('show',show);
  if(show)$('#backupMsg').textContent=days===null?'還沒有備份過。':`已經 ${days} 天沒有備份了。`;
}

/* ---------- Table ---------- */
function ivCell(d){
  const l=d.interviews||[];if(!l.length)return '<span class="nil">—</span>';
  const cur=currentInterview(d), up=isFuture(cur.when), ago=cur.when&&!up?daysSinceIv(cur):null;
  // the status pill already says "waiting"; only show a result tag once there is a verdict
  const tag=['通過','未通過'].includes(cur.result)?`<span class="res res-${esc(cur.result)}">${esc(cur.result)}</span>`:'';
  return `<div class="iv-cell"><span class="rd">${esc(cur.round)}</span>${tag}
    ${cur.when?`<div class="when ${up?'up':''}">${esc(fmtDT(cur.when))}${cur.mode?' · '+esc(cur.mode):''}</div>`:''}
    ${ago!==null||l.length>1?`<div class="sub">${ago!==null?(ago===0?'今天':ago+' 天前'):''}${ago!==null&&l.length>1?' · ':''}${l.length>1?l.map(x=>esc(x.round)).join(' → '):''}</div>`:''}</div>`;
}
const flagsHTML=d=>attention(d).map(a=>`<span class="flag ${a.k==='today'?'today':''}">${a.t}</span>`).join('');
// 下一步 is for non-interview to-dos; when it's empty, fall back to the next scheduled interview
function nextCell(d,over){
  const f=flagsHTML(d), flags=f?`<div class="flags">${f}</div>`:'';
  if(d.next||d.nextDate)return flags+`${d.next?esc(d.next):'<span class="nil">—</span>'}${d.nextDate?`<div><b class="${over?'warn':''}">${esc(d.nextDate)}</b></div>`:''}`;
  const nx=nextInterview(d);
  if(nx)return flags+`<span style="color:var(--plum)">📅 ${esc(nx.round)}</span><div><b>${esc(fmtDT(nx.when))}</b></div>`;
  return flags||'<span class="nil">—</span>';
}
function rowHTML(d,inGroup){
  const S=st(d.status), ds=daysSince(d.date), inb=org(d)==='公司邀約', over=d.nextDate&&d.nextDate<todayStr()&&!CLOSED.includes(S.k);
  // on narrow screens the channel, location and note columns fold into the company cell (.nar)
  const loc=[d.location,d.salary].filter(Boolean).map(esc).join(' · ');
  return `<tr data-row="${d.id}" class="${selected.has(d.id)?'sel':''} ${inGroup?'in-grp':''}">
    <td class="ck"><input type="checkbox" class="cb" data-ck="${d.id}" ${selected.has(d.id)?'checked':''}></td>
    <td class="c-co"><div class="co"><span class="co-name" data-edit="${d.id}" title="點一下編輯">${esc(d.company)}</span>${inb?'<span class="inb">公司邀約</span>':''}${SHOW_CAT&&d.category&&!inGroup?catTag(d.category):''}${d.link?`<a href="${esc(d.link)}" target="_blank" rel="noopener">職缺↗</a>`:''}</div><div class="sub">${esc(d.position)}</div>
      ${d.channel?`<div class="nar nar-ch">管道：${esc(d.channel)}</div>`:''}${loc?`<div class="nar nar-loc">📍 ${loc}</div>`:''}${d.note?`<div class="nar nar-note">${esc(d.note)}</div>`:''}</td>
    <td class="c-date"><div class="date">${esc(d.date||'—')}</div>${ds!==null?`<div class="days">${inb?'聯繫':'投遞'} · ${ds===0?'今天':ds>0?ds+' 天前':-ds+' 天後'}</div>`:''}</td>
    <td class="c-ch">${d.channel?esc(d.channel):'<span class="nil">—</span>'}</td>
    <td class="c-st"><select class="pill" data-id="${d.id}" style="background:${S.bg};color:${S.c}">${STATUSES.map(x=>`<option ${x.k===S.k?'selected':''}>${x.k}</option>`).join('')}</select></td>
    <td class="c-iv">${ivCell(d)}</td>
    <td class="c-loc">${d.location?esc(d.location):'<span class="nil">—</span>'}${d.salary?`<div class="sub">${esc(d.salary)}</div>`:''}</td>
    <td class="c-next next">${nextCell(d,over)}${d.contact?`<div class="sub">聯絡：${esc(d.contact)}</div>`:''}</td>
    <td class="c-note note">${d.note?esc(d.note):'<span class="nil">—</span>'}</td>
    <td class="c-act row-act"><button data-edit="${d.id}">編輯</button></td>
  </tr>`;
}
function groupHTML(g){
  const c=collapsedCo.has(g.k), cat=(g.list.find(d=>d.category)||{}).category;
  const sum=STATUSES.map(s=>[s,g.list.filter(d=>st(d.status).k===s.k).length]).filter(x=>x[1]).map(([s,n])=>`<span style="color:${s.c}">${s.k} ${n}</span>`).join(' · ');
  return `<tr class="grp"><td class="ck"><input type="checkbox" class="cb" data-gck="${esc(g.k)}" title="選取這間公司的全部紀錄"></td>
    <td colspan="9"><div class="grp-h"><button type="button" class="gtog" data-tog="${esc(g.k)}" title="${c?'展開':'收合'}">${c?'▸':'▾'}</button><span class="gname" data-tog="${esc(g.k)}">${esc(g.name)}</span>${SHOW_CAT&&cat?catTag(cat):''}<span class="gsum">${g.list.length} 筆 · ${sum}</span>${F.co?'':`<button type="button" class="only" data-only="${esc(g.k)}">只看這間</button>`}</div></td></tr>`;
}
/* the line above the table: what is being shown, how many, and in what order */
const SORT_NAMES={date:'日期',company:'公司',channel:'管道',status:'狀態',interview:'面試進度',nextDate:'下一步'};
function renderTableSum(total,nCo){
  const what=ghostOnly?'很久沒消息':attnOnly?'待處理':!filter?'進行中':filter==='ALL'?'全部紀錄':filter;
  const dir=['date','interview','nextDate'].includes(sortKey)?(sortDir===-1?'新→舊':'舊→新'):sortKey==='status'?(sortDir===1?'照流程':'反向'):(sortDir===1?'A→Z':'Z→A');
  const extra=[panelN()&&'已套用篩選',$('#q').value.trim()&&`搜尋「${esc($('#q').value.trim())}」`,$('#originF').value&&esc($('#originF').value)].filter(Boolean).join('・');
  $('#tbSum').innerHTML=`<span class="t">${esc(what)}</span><span class="n">${total} 筆</span>${nCo?`<span class="s">${nCo} 間公司</span>`:''}`+
    `<span class="s sd">排序：<b>${SORT_NAMES[sortKey]}（${dir}）</b><span class="wide">・點表頭可以換</span></span>${extra?`<span class="s">${extra}</span>`:''}`;
}
function renderTable(rows){
  document.querySelectorAll('th[data-sort]').forEach(th=>{th.classList.toggle('asc',th.dataset.sort===sortKey&&sortDir===1);th.classList.toggle('desc',th.dataset.sort===sortKey&&sortDir===-1)});
  const total=rows.length;let pages, label, pageRows, groups=null;
  if(groupCo&&total){
    // groups keep the current sort order (by their first record) and are never split across pages
    const map=new Map();
    rows.forEach(d=>{const k=normKey(d.company);if(!map.has(k))map.set(k,{k,name:d.company,list:[]});map.get(k).list.push(d)});
    const all=[...map.values()], book=[[]];let cnt=0;
    all.forEach(g=>{if(cnt>=pageSize){book.push([]);cnt=0}book[book.length-1].push(g);cnt+=collapsedCo.has(g.k)?1:g.list.length});
    pages=book.length;page=Math.min(Math.max(1,page),pages);groups=book[page-1];
    pageRows=groups.flatMap(g=>collapsedCo.has(g.k)?[]:g.list);
    label=`共 ${all.length} 間公司、${total} 筆${pages>1?` · 這頁 ${groups.length} 間`:''}`;
  }else{
    pages=Math.max(1,Math.ceil(total/pageSize));page=Math.min(Math.max(1,page),pages);
    const from=(page-1)*pageSize;pageRows=rows.slice(from,from+pageSize);
    label=`共 ${total} 筆 · 顯示第 ${from+1}–${Math.min(from+pageSize,total)} 筆`;
  }
  renderPager(total,pages,label);
  renderTableSum(total,groups&&new Set(rows.map(d=>normKey(d.company))).size);
  visibleIds=pageRows.map(d=>d.id);
  updateBulk();
  if(!total){
    const tip=hiddenClosed?`另有 ${hiddenClosed} 筆已結束的紀錄，點上方「全部」卡片就能看到`:panelN()?'可以按篩選列右邊的「清除篩選」看看':data.length?'換個關鍵字或篩選試試':'按「新增投遞」開始記錄，或從之前的備份還原';
    $('#tbody').innerHTML=`<tr><td colspan="10"><div class="empty"><div class="big">${data.length?'沒有符合的紀錄':'還沒有任何投遞紀錄'}</div>${tip}</div></td></tr>`;
    return;
  }
  $('#tbody').innerHTML=groups?groups.map(g=>groupHTML(g)+(collapsedCo.has(g.k)?'':g.list.map(d=>rowHTML(d,true)).join(''))).join(''):pageRows.map(d=>rowHTML(d,false)).join('');
  document.querySelectorAll('select.pill').forEach(el=>el.onchange=()=>setStatus(el.dataset.id,el.value));
  document.querySelectorAll('[data-edit]').forEach(el=>el.onclick=()=>openDlg(el.dataset.edit));
  // phones show rows as cards without an edit button: tapping the card opens it
  document.querySelectorAll('tr[data-row]').forEach(tr=>tr.onclick=e=>{
    if(!PHONE.matches||e.target.closest('input,select,a,button,label,.cat,[data-edit],td.ck,td.c-st'))return;
    openDlg(tr.dataset.row);
  });
  document.querySelectorAll('[data-ck]').forEach(el=>el.onchange=()=>{
    el.checked?selected.add(el.dataset.ck):selected.delete(el.dataset.ck);
    if(groups)return render();// keeps the company checkbox in step
    el.closest('tr').classList.toggle('sel',el.checked);updateBulk();
  });
  document.querySelectorAll('#tbody [data-cat]').forEach(el=>el.onclick=e=>{e.stopPropagation();setFilter('cat',el.dataset.cat)});
  if(!groups)return;
  const byK=new Map(groups.map(g=>[g.k,g]));
  document.querySelectorAll('[data-gck]').forEach(el=>{
    const ids=byK.get(el.dataset.gck).list.map(d=>d.id), n=ids.filter(id=>selected.has(id)).length;
    el.checked=n===ids.length;el.indeterminate=n>0&&n<ids.length;
    el.onchange=()=>{ids.forEach(id=>el.checked?selected.add(id):selected.delete(id));render()};
  });
  document.querySelectorAll('[data-tog]').forEach(el=>el.onclick=()=>{const k=el.dataset.tog;collapsedCo.has(k)?collapsedCo.delete(k):collapsedCo.add(k);render()});
  document.querySelectorAll('[data-only]').forEach(el=>el.onclick=()=>setFilter('co',el.dataset.only));
}
function setStatus(id,v){
  const r=data.find(x=>x.id===id);if(!r||r.status===v)return;
  snapshot();applyStatusToInterviews(r,v);r.status=v;save();render();toast(`${r.company} → ${v}`,{undo:true});
}
function renderPager(total,pages,label){
  const el=$('#pager');
  if(!total){el.innerHTML='';return}
  const nums=[];for(let i=1;i<=pages;i++)if(i===1||i===pages||Math.abs(i-page)<=1)nums.push(i);
  const btns=[];nums.forEach((n,i)=>{if(i&&n-nums[i-1]>1)btns.push('<span>…</span>');btns.push(`<button class="pg ${n===page?'cur':''}" data-pg="${n}">${n}</button>`)});
  el.innerHTML=`<div>${label}${hiddenClosed?`（另有 ${hiddenClosed} 筆已結束，點「全部」查看）`:''}</div>
    <div class="pages"><button class="pg" data-pg="${page-1}" ${page===1?'disabled':''}>‹</button>${btns.join('')}<button class="pg" data-pg="${page+1}" ${page===pages?'disabled':''}>›</button></div>
    <div>每頁<select id="pageSize">${[10,20,50,100].map(n=>`<option ${n===pageSize?'selected':''}>${n}</option>`).join('')}</select>筆</div>`;
  el.querySelectorAll('[data-pg]').forEach(b=>b.onclick=()=>{page=+b.dataset.pg;render();$('.table-wrap').scrollIntoView({behavior:'smooth',block:'start'})});
  $('#pageSize').onchange=e=>{pageSize=+e.target.value;localStorage.setItem(KEY+'-pagesize',pageSize);page=1;render()};
}
