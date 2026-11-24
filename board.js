/* ---------- Kanban ---------- */
const KB_CLOSED_LIMIT=5;
const kbExpanded=new Set();
function renderKanban(rows){
  visibleIds=[];updateBulk();
  // under 進行中 the finished columns are left out, but stay reachable as a slim drop strip under the board
  const hideMode=!filter&&!ghostOnly;
  const cols=hideMode?STATUSES.filter(s=>!CLOSED.includes(s.k)):STATUSES;
  $('#kanban').style.gridTemplateColumns=`repeat(${cols.length},minmax(0,1fr))`;
  $('#kbHidden').textContent=panelN()?'目前套用了上方的篩選。':'';
  const drops=hideMode?`<div class="drops"><span class="drops-h">已結束</span>${STATUSES.filter(s=>CLOSED.includes(s.k)).map(s=>
    `<div class="drop" data-status="${s.k}" title="把卡片拖到這裡就會改成「${s.k}」，點一下可以查看"><span class="dot" style="background:${s.c}"></span>${s.k}<span class="c">${data.filter(d=>passPanel(d)&&otherPass(d)&&st(d.status).k===s.k).length}</span></div>`).join('')}</div>`:'';
  $('#kanban').innerHTML=cols.map(s=>{
    const list=rows.filter(d=>st(d.status).k===s.k), closed=CLOSED.includes(s.k);
    // finished columns show a few slim cards; the rest stay folded until asked for
    const shown=closed&&!kbExpanded.has(s.k)?list.slice(0,KB_CLOSED_LIMIT):list;
    return `<div class="col" data-status="${s.k}">
      <div class="col-h"><span class="dot" style="background:${s.c}"></span>${s.k}<span class="c">${list.length}</span></div>
      <div class="col-body ${shown.length?'':'empty'}">
      ${shown.map(d=>{const nx=nextInterview(d), ld=lastDone(d);return `<div class="card ${closed?'slim':''}" draggable="true" data-id="${d.id}" style="border-left-color:${s.c}" title="${esc(d.company)}｜${esc(d.position)}${SHOW_CAT&&d.category?'｜'+esc(d.category):''}">
        <div class="t">${esc(d.company)}${org(d)==='公司邀約'?'<span class="inb">邀約</span>':''}</div>
        <div class="p">${esc(d.position)}</div>
        <div class="m">${esc(d.date||'')}${d.channel?' · '+esc(d.channel):''}${SHOW_CAT&&d.category?' · '+esc(d.category):''}</div>
        ${nx?`<div class="m" style="color:var(--plum);font-weight:600">${esc(nx.round)} ${esc(fmtDT(nx.when))}</div>`:ld?`<div class="m">${esc(ld.round)}後 ${daysSinceIv(ld)} 天 · ${esc(ld.result)}</div>`:''}
        ${flagsHTML(d)?`<div style="margin-top:4px">${flagsHTML(d)}</div>`:''}
      </div>`}).join('')}
      </div>
      ${closed&&list.length>KB_CLOSED_LIMIT?`<button class="col-more" data-more="${s.k}">${kbExpanded.has(s.k)?'收起':`顯示其餘 ${list.length-KB_CLOSED_LIMIT} 筆`}</button>`:''}
    </div>`}).join('')+drops;
  document.querySelectorAll('.drop').forEach(c=>{
    c.onclick=()=>{filter=c.dataset.status;page=1;render()};
    c.ondragover=e=>{e.preventDefault();c.classList.add('over')};
    c.ondragleave=()=>c.classList.remove('over');
    c.ondrop=e=>{e.preventDefault();c.classList.remove('over');setStatus(e.dataTransfer.getData('text/plain'),c.dataset.status)};
  });
  document.querySelectorAll('[data-more]').forEach(b=>b.onclick=()=>{const k=b.dataset.more;kbExpanded.has(k)?kbExpanded.delete(k):kbExpanded.add(k);render()});
  document.querySelectorAll('.card').forEach(c=>{
    c.ondragstart=e=>{e.dataTransfer.setData('text/plain',c.dataset.id);c.classList.add('dragging')};
    c.ondragend=()=>c.classList.remove('dragging');
    c.onclick=()=>openView(c.dataset.id);
  });
  document.querySelectorAll('.col').forEach(col=>{
    col.ondragover=e=>{e.preventDefault();col.classList.add('over')};
    col.ondragleave=()=>col.classList.remove('over');
    col.ondrop=e=>{e.preventDefault();col.classList.remove('over');setStatus(e.dataTransfer.getData('text/plain'),col.dataset.status)};
  });
}

/* ---------- Analytics ---------- */
const pct=(a,b)=>b?Math.round(a/b*100)+'%':'—';
const interviewed=d=>(d.interviews||[]).length>0||['面試中','等待結果','錄取'].includes(st(d.status).k);
const replied=d=>!['已投遞','無回應'].includes(st(d.status).k)||interviewed(d);
function renderAnalytics(rows){
  visibleIds=[];updateBulk();
  if(!rows.length){$('#analytics').innerHTML=`<div class="panel full"><div class="empty"><div class="big">${data.length?'篩選後沒有紀錄可以分析':'還沒有資料可以分析'}</div>${data.length?'換個篩選條件，或關掉「分析也套用篩選」。':'新增或匯入紀錄後，這裡會顯示投遞成效。'}</div></div>`;return}
  const scope=anFiltered&&panelN()?`篩選後的 ${rows.length} 筆紀錄（不受上方卡片和搜尋影響）`:`全部 ${rows.length} 筆紀錄，不受上方卡片、搜尋和篩選影響`;
  const N=rows.length, rep=rows.filter(replied).length, iv=rows.filter(interviewed).length, ok=rows.filter(d=>st(d.status).k==='錄取').length;
  const funnel=[['全部機會',N,''],['有回音',rep,pct(rep,N)+' 回覆率'],['進入面試',iv,pct(iv,N)+' 面試率'],['錄取',ok,pct(ok,N)+' 錄取率']];

  // by channel: top 8, rest folded into 其他
  const byCh={};rows.forEach(d=>{const k=d.channel||'（未填）';(byCh[k]||(byCh[k]={n:0,iv:0,ok:0})).n++;if(interviewed(d))byCh[k].iv++;if(st(d.status).k==='錄取')byCh[k].ok++});
  let ch=Object.entries(byCh).sort((a,b)=>b[1].n-a[1].n);
  if(ch.length>8){const rest=ch.slice(7).reduce((s,[,v])=>({n:s.n+v.n,iv:s.iv+v.iv,ok:s.ok+v.ok}),{n:0,iv:0,ok:0});ch=[...ch.slice(0,7),['其他',rest]]}
  const maxN=Math.max(...ch.map(([,v])=>v.n));

  // weekly volume, last 12 weeks (weeks start Monday)
  const mon=new Date();mon.setHours(0,0,0,0);mon.setDate(mon.getDate()-((mon.getDay()+6)%7));
  const weeks=[...Array(12)].map((_,i)=>{const s=new Date(mon);s.setDate(s.getDate()-7*(11-i));const e=new Date(s);e.setDate(e.getDate()+7);
    const list=rows.filter(d=>{const t=parseDay(d.date);return t&&t>=s&&t<e});
    return {s,n:list.length,inb:list.filter(d=>org(d)==='公司邀約').length}});
  const maxW=Math.max(1,...weeks.map(w=>w.n));

  const byOrg=['主動投遞','公司邀約'].map(o=>{const l=rows.filter(d=>org(d)===o);return [o,l.length,l.filter(interviewed).length,l.filter(d=>st(d.status).k==='錄取').length]});
  const byRound={};rows.forEach(d=>(d.interviews||[]).forEach(x=>{const r=byRound[x.round]||(byRound[x.round]={n:0,pass:0,fail:0});r.n++;if(x.result==='通過')r.pass++;if(x.result==='未通過')r.fail++}));
  const roundRows=ROUNDS.filter(r=>byRound[r]).concat(Object.keys(byRound).filter(r=>!ROUNDS.includes(r)));

  $('#analytics').innerHTML=`
    <div class="panel full"><h3>投遞漏斗</h3><p class="desc">${scope}。百分比都是相對於全部機會。</p>
      <div class="funnel">${funnel.map(([l,n,r])=>`<div class="fstep"><div class="n">${n}</div><div class="l">${l}</div>${r?`<div class="r">${r}</div>`:''}</div>`).join('')}</div></div>
    <div class="panel"><h3>哪個管道最有效</h3><p class="desc">淺色是總筆數，深色是其中進到面試的筆數。</p>
      <div class="legend"><span><i style="background:#c9d9ce"></i>總筆數</span><span><i style="background:var(--green)"></i>進入面試</span></div>
      ${ch.map(([k,v])=>`<div class="hbar" data-tip="${esc(k)}：${v.n} 筆，面試 ${v.iv}（${pct(v.iv,v.n)}），錄取 ${v.ok}">
        <div class="nm">${esc(k)}</div>
        <div class="track"><div class="fill ghost" style="width:${v.n/maxN*100}%"></div><div class="fill" style="width:${v.iv/maxN*100}%"></div></div>
        <div class="v">${v.n} 筆 · ${pct(v.iv,v.n)}</div></div>`).join('')}</div>
    <div class="panel"><h3>每週新增機會</h3><p class="desc">最近 12 週，依投遞／聯繫日期計算。滑鼠移到長條上看細節。</p>
      <div class="weeks">${weeks.map((w,i)=>`<div class="wk" data-tip="${w.s.getMonth()+1}/${w.s.getDate()} 那週：${w.n} 筆${w.inb?`（含邀約 ${w.inb}）`:''}">
        <div class="b" style="height:${w.n/maxW*100}%"></div>${i%2===1||i===11?`<span class="lbl">${w.s.getMonth()+1}/${w.s.getDate()}</span>`:''}</div>`).join('')}</div>
      <div style="height:24px"></div></div>
    <div class="panel"><h3>主動投遞 vs 公司邀約</h3><p class="desc">看哪一種來源比較容易走到面試與錄取。</p>
      <table class="an-table"><thead><tr><th>來源</th><th>筆數</th><th>面試率</th><th>錄取率</th></tr></thead>
      <tbody>${byOrg.map(([o,n,i,k])=>`<tr><td>${o}</td><td>${n}</td><td>${pct(i,n)}</td><td>${pct(k,n)}</td></tr>`).join('')}</tbody></table></div>
    <div class="panel"><h3>各輪面試結果</h3><p class="desc">通過率只算已經有結果（通過或未通過）的場次。</p>
      ${roundRows.length?`<table class="an-table"><thead><tr><th>輪次</th><th>場次</th><th>通過</th><th>未通過</th><th>通過率</th></tr></thead>
      <tbody>${roundRows.map(r=>{const v=byRound[r];return `<tr><td>${esc(r)}</td><td>${v.n}</td><td>${v.pass}</td><td>${v.fail}</td><td>${pct(v.pass,v.pass+v.fail)}</td></tr>`}).join('')}</tbody></table>`:'<p class="desc">還沒有面試紀錄。</p>'}</div>`;
}

/* ---------- Tooltip ---------- */
document.addEventListener('mousemove',e=>{
  const t=e.target.closest('[data-tip]'), tip=$('#tip');
  if(!t){tip.classList.remove('show');return}
  tip.textContent=t.dataset.tip;tip.classList.add('show');
  const w=tip.offsetWidth;tip.style.left=Math.min(e.clientX+14,innerWidth-w-8)+'px';tip.style.top=(e.clientY+16)+'px';
});

/* ---------- Main render ---------- */
function render(){
  // phones have no board: a board left open on a wider screen shows as the list there
  if(PHONE.matches&&view==='kanban')view='table';
  [...selected].forEach(id=>{if(!data.some(d=>d.id===id))selected.delete(id)});
  // the "long silence" view is a one-off: drop it once nothing matches any more
  if(ghostOnly&&!data.some(d=>ghost(d)||ivGhost(d)))ghostOnly=false;
  renderFilters();renderStats();renderUpcoming();renderBackup();renderSuggest();
  // remember the filter row, search and source so they survive a reload
  localStorage.setItem(KEY+'-filters',JSON.stringify({F,q:$('#q').value,of:$('#originF').value}));
  // the table and board follow the cards and filters; analytics uses every record unless told to follow the filter row
  const rows=getRows(view==='stats'), anRows=anFiltered?data.filter(passPanel):data;
  // a selection must never include records the current filters hide, or a bulk delete could hit rows you can't see
  if(view==='table'){const keep=new Set(rows.map(d=>d.id));[...selected].forEach(id=>{if(!keep.has(id))selected.delete(id)})}
  const res=$('#fRes');res.hidden=!panelN()||(view==='stats'&&!anFiltered);
  res.textContent=view==='stats'?`篩選後 ${anRows.length} 筆`:`篩選後 ${rows.length} 筆${hiddenClosed?`（另有 ${hiddenClosed} 筆已結束）`:''}`;
  document.body.classList.toggle('v-stats',view==='stats');
  document.body.classList.toggle('an-f',anFiltered);
  $('#anF').checked=anFiltered;
  $('#anNote').textContent=!anFiltered?'目前分析全部紀錄。':panelN()?`目前分析 ${anRows.length} / ${data.length} 筆。`:'還沒選任何篩選條件，所以等於全部紀錄。';
  $('#vTable').hidden=view!=='table';$('#vKanban').hidden=view!=='kanban';$('#vStats').hidden=view!=='stats';
  document.querySelectorAll('#views button,#tabbar [data-v]').forEach(b=>b.classList.toggle('on',b.dataset.v===view));
  if(view==='table')renderTable(rows);else if(view==='kanban')renderKanban(rows);else renderAnalytics(anRows);
}
