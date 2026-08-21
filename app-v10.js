(()=>{
'use strict';
const APP_VERSION='v10.1';
const KEY='fantasta26_state_v2';
const ROLE_ORDER={P:0,D:1,C:2,A:3};
const ROLE_NAMES={P:'Portieri',D:'Difensori',C:'Centrocampisti',A:'Attaccanti'};
const DEFAULT_SLOTS={P:3,D:8,C:8,A:6};
const $=s=>document.querySelector(s);
const finiteOr=(value,fallback)=>Number.isFinite(Number(value))?Number(value):fallback;
function grade(q){return q>=23?'TOP':q>=14?'OTTIMO':q>=8?'BUONO':q<=6?'SCOMMESSA':'NORMALE'}
function parseCatalog(){
  const text=[window.FANTA_BASE||'',window.FANTA_EXTRA||''].filter(Boolean).join('\n');
  const seen=new Set();
  return text.split('\n').map(x=>x.trim()).filter(Boolean).map((x,i)=>{
    const [r,n,t,qs]=x.split('|');const q=Number(qs);
    return{id:i,r,n,t,q,g:grade(q),status:'free',paid:0};
  }).filter(p=>{
    const k=p.r+'|'+p.n;
    if(!ROLE_NAMES[p.r]||!p.n||!p.t||!Number.isFinite(p.q)||seen.has(k))return false;
    seen.add(k);return true;
  });
}
const catalog=parseCatalog();
let previous=null;try{previous=JSON.parse(localStorage.getItem(KEY))}catch{}
const oldMap=new Map((previous?.players||[]).map(p=>[p.r+'|'+p.n,p]));
const players=catalog.map(p=>{const old=oldMap.get(p.r+'|'+p.n);return old?{...p,status:['mine','other','free'].includes(old.status)?old.status:'free',paid:finiteOr(old.paid,0)}:{...p}});
let st={
  budget:Math.max(1,finiteOr(previous?.budget,500)),
  slots:{P:Math.max(0,finiteOr(previous?.slots?.P,DEFAULT_SLOTS.P)),D:Math.max(0,finiteOr(previous?.slots?.D,DEFAULT_SLOTS.D)),C:Math.max(0,finiteOr(previous?.slots?.C,DEFAULT_SLOTS.C)),A:Math.max(0,finiteOr(previous?.slots?.A,DEFAULT_SLOTS.A))},
  players,
  closed:Array.isArray(previous?.closed)?previous.closed.filter(r=>ROLE_NAMES[r]):[],
  view:previous?.view||'P',
  minQ:Math.max(1,finiteOr(previous?.minQ,1))
};
if(!['P','D','C','A','MINE','OTHERS','SET'].includes(st.view))st.view='P';
function save(){localStorage.setItem(KEY,JSON.stringify(st))}
save();
function mine(){return st.players.filter(p=>p.status==='mine')}
function totalSlots(){return Object.values(st.slots).reduce((a,b)=>a+(finiteOr(b,0)),0)}
function credits(){return st.budget-mine().reduce((a,p)=>a+finiteOr(p.paid,0),0)}
function remainingSlots(){return Math.max(0,totalSlots()-mine().length)}
function maxBid(){return Math.max(0,credits()-Math.max(0,remainingSlots()-1))}
function roleMineCount(r){return mine().filter(p=>p.r===r).length}
function gradeClass(g){return'grade-'+String(g).toLowerCase()}
function byQuote(a,b){return b.q-a.q||a.n.localeCompare(b.n,'it')}
function byRoleQuote(a,b){return(ROLE_ORDER[a.r]??9)-(ROLE_ORDER[b.r]??9)||byQuote(a,b)}
function escapeHtml(s){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function choose(p){
  if(p.status!=='free'){
    if(confirm('Ripristinare '+p.n+' tra i disponibili?')){p.status='free';p.paid=0;save();render()}
    return;
  }
  $('#action').innerHTML=`<div class="panel buyPanel"><h3>${escapeHtml(p.n)}</h3><div class="small">${escapeHtml(p.t)} · ${p.r} · Quotazione ${p.q}</div><div class="actions"><button id="my">👕 MIO</button><button id="other">👥 ALTRO</button><button id="cancel">Annulla</button></div><div id="price" class="hidden priceRow"><span>Prezzo</span><input id="pv" type="number" min="1" value="1" inputmode="numeric"><button id="confirm" class="ok">Conferma</button><div class="small">Massimo disponibile: ${maxBid()}</div></div></div>`;
  $('#my').onclick=()=>$('#price').classList.remove('hidden');
  $('#other').onclick=()=>{p.status='other';$('#action').innerHTML='';save();render()};
  $('#cancel').onclick=()=>{$('#action').innerHTML=''};
  $('#confirm').onclick=()=>{
    const v=Math.floor(Number($('#pv').value));
    if(roleMineCount(p.r)>=finiteOr(st.slots[p.r],0))return alert('Slot '+p.r+' già completi');
    if(!Number.isFinite(v)||v<1||v>maxBid())return alert('Prezzo non valido. Massimo '+maxBid());
    p.status='mine';p.paid=v;$('#action').innerHTML='';save();render();
  };
}
function settingsHtml(){
  const closed=st.closed.map(r=>`<button data-reopen="${r}">${ROLE_NAMES[r]}</button>`).join('');
  return `<div class="panel"><h3>Impostazioni rosa</h3><div class="settingsGrid"><label>Budget<input id="budget" type="number" min="1" value="${st.budget}"></label>${['P','D','C','A'].map(r=>`<label>${r}<input data-slot="${r}" type="number" min="0" value="${st.slots[r]}"></label>`).join('')}</div><div class="actions"><button id="saveSet" class="ok">Salva impostazioni</button><button id="reopenRole">↩️ Riapri reparto</button><button id="reset" class="danger">Reset completo asta</button></div><div id="reopenBox" class="reopenBox hidden"><div class="small">Quale reparto vuoi riaprire?</div><div class="actions">${closed||'<span class="small">Nessun reparto chiuso.</span>'}</div></div><div class="small">Totale rosa: ${totalSlots()} giocatori. Lo stato viene salvato automaticamente su questo dispositivo.</div><div class="version">FantAsta ${APP_VERSION} · ${catalog.length} giocatori</div></div>`;
}
function bindSettings(){
  $('#saveSet').onclick=()=>{
    st.budget=Math.max(1,Math.floor(finiteOr($('#budget').value,500)));
    document.querySelectorAll('[data-slot]').forEach(i=>st.slots[i.dataset.slot]=Math.max(0,Math.floor(finiteOr(i.value,0))));
    save();render();
  };
  $('#reopenRole').onclick=()=>$('#reopenBox').classList.toggle('hidden');
  document.querySelectorAll('[data-reopen]').forEach(b=>b.onclick=()=>{const r=b.dataset.reopen;st.closed=st.closed.filter(x=>x!==r);st.view=r;save();render()});
  $('#reset').onclick=()=>{if(confirm('Cancellare tutta l’asta salvata? Questa azione non si può annullare.')){localStorage.removeItem(KEY);location.reload()}};
}
function render(){
  const m=mine();
  $('#credits').textContent=credits();$('#squad').textContent=m.length+'/'+totalSlots();$('#maxBid').textContent=maxBid();
  document.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===st.view);if(ROLE_NAMES[b.dataset.view])b.classList.toggle('hidden',st.closed.includes(b.dataset.view))});
  const isRole=Boolean(ROLE_NAMES[st.view]);
  $('#roleActions').classList.toggle('hidden',!isRole);$('#search').classList.toggle('hidden',st.view==='SET');$('#filterWrap').classList.toggle('hidden',!isRole);$('#minQ').value=String(st.minQ||1);
  $('#list').innerHTML='';$('#action').innerHTML='';
  if(st.view==='SET'){$('#info').innerHTML=settingsHtml();bindSettings();return}
  const term=$('#search').value.trim().toLowerCase();
  let arr;
  if(st.view==='MINE')arr=m.slice().sort(byRoleQuote);
  else if(st.view==='OTHERS')arr=st.players.filter(p=>p.status==='other').sort(byRoleQuote);
  else arr=st.players.filter(p=>p.r===st.view&&p.status==='free'&&p.q>=st.minQ).sort(byQuote);
  if(term)arr=arr.filter(p=>(p.n+' '+p.t).toLowerCase().includes(term));
  $('#info').textContent=st.view==='MINE'?`Mia squadra: ${m.length}/${totalSlots()} · ${credits()} crediti rimasti`:st.view==='OTHERS'?`Acquistati dagli altri: ${arr.length}`:`Disponibili: ${arr.length} · Tuoi nel ruolo: ${roleMineCount(st.view)}/${st.slots[st.view]}`;
  arr.forEach(p=>{const b=document.createElement('button');b.className='player';b.innerHTML=`<span class="playerText"><span class="pn">${escapeHtml(p.n)}</span><span class="meta">${escapeHtml(p.t)} · ${p.r}${p.status==='mine'?' · pagato '+p.paid:''}</span><span class="grade ${gradeClass(p.g)}">${p.g}</span></span><span class="quote">${p.q}</span>`;b.onclick=()=>choose(p);$('#list').appendChild(b)});
}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{st.view=b.dataset.view;$('#search').value='';save();render()});
$('#search').oninput=render;
$('#minQ').onchange=()=>{st.minQ=Math.max(1,finiteOr($('#minQ').value,1));save();render()};
$('#closeRole').onclick=()=>{const r=st.view;if(!ROLE_NAMES[r])return;if(confirm('Chiudere il reparto '+ROLE_NAMES[r]+'?')){if(!st.closed.includes(r))st.closed.push(r);st.view=['P','D','C','A'].find(x=>!st.closed.includes(x))||'MINE';save();render()}};
render();
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js?v=10.1').catch(()=>{});
})();