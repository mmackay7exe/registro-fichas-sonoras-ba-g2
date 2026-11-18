(async function(){
'use strict';
const {$, $$} = FB;
const form=$('#f'), hidden=form.elements.croquis, cv=$('#cv'), ctx=cv.getContext('2d');
const COL=FB.FUENTE_COLORES;

/* selector de tipo de fuente */
$('#tipo-fuente').innerHTML=Object.entries(FB.FUENTE_TIPOS).map(([k,v],i)=>
  `<label class="chip" title="${v}"><input type="radio" name="tipoFuente" value="${k}" data-skip ${i===1?'checked':''}><span><i class="dot" style="background:${COL[k]}"></i>${k} · ${v}</span></label>`).join('');
$('#legend').innerHTML=Object.entries(FB.FUENTE_TIPOS).map(([k,v])=>`<span><i class="dot" style="background:${COL[k]}"></i>${k} ${v}</span>`).join('');

FB.wireCommon(form);
await FB.renderLugares($('[data-lugares]',form),form);
const page=await FB.ficha({tipo:'cartografia',form,onAfterSave:rec=>FB.wireNext(rec)});
FB.prefill(form);
const cod=$('[name=codigo]',form);
const link=await FB.enlazarSonora(form,cod);
if(!page.rec&&cod.value) link.fill();
const lc=$('[data-lugares]',form); lc._upd&&lc._upd();
cod.addEventListener('blur',()=>{const v=FB.normCodigo(cod.value); if(v!==cod.value){cod.value=v;page.touch();}});

/* ---------- datos del croquis ---------- */
let sk={markers:[],strokes:[],order:[]};
try{ const p=JSON.parse(hidden.value||'{}'); sk={markers:p.markers||[],strokes:p.strokes||[],order:p.order||[]}; }catch(e){}
let detalles={}; // id -> {desc,mov,dist}
const prev=(page.rec&&page.rec.data.fuentesMapa)||[];
sk.markers.forEach((m,i)=>{ if(prev[i]) detalles[m.id]={desc:prev[i].desc||'',mov:prev[i].mov||'',dist:prev[i].dist||''}; });

function relabel(){ const c={}; sk.markers.forEach(m=>{c[m.tipo]=(c[m.tipo]||0)+1; m.label=m.tipo+c[m.tipo];}); }
function commit(){ relabel(); hidden.value=JSON.stringify(sk,(k,v)=>typeof v==='number'?+v.toFixed(4):v); renderRows(); draw(); page.touch(); }

/* ---------- dibujo ---------- */
let W=0,dpr=1;
function size(){ dpr=Math.min(2,window.devicePixelRatio||1); W=cv.parentElement.clientWidth; cv.width=W*dpr; cv.height=W*dpr; cv.style.height=W+'px'; draw(); }
function draw(c=ctx,w=W,scale=dpr){
  c.setTransform(scale,0,0,scale,0,0);
  c.fillStyle='#fff'; c.fillRect(0,0,w,w);
  c.strokeStyle='#EEF0F2'; c.lineWidth=1;
  for(let i=1;i<10;i++){const p=i*w/10; c.beginPath();c.moveTo(p,0);c.lineTo(p,w);c.moveTo(0,p);c.lineTo(w,p);c.stroke();}
  c.strokeStyle='#D9DDE2'; c.setLineDash([4,4]);
  [.2,.4].forEach(r=>{c.beginPath();c.arc(w/2,w/2,r*w,0,Math.PI*2);c.stroke();});
  c.setLineDash([]);
  // trazos
  c.strokeStyle='#111417'; c.lineWidth=2.2; c.lineCap='round'; c.lineJoin='round';
  sk.strokes.forEach(s=>{ if(s.length<2) return; c.beginPath(); c.moveTo(s[0][0]*w,s[0][1]*w); s.slice(1).forEach(p=>c.lineTo(p[0]*w,p[1]*w)); c.stroke(); });
  // observador
  const cx=w/2, cy=w/2;
  c.fillStyle='#111417'; c.beginPath(); c.moveTo(cx,cy-22); c.lineTo(cx-7,cy-9); c.lineTo(cx+7,cy-9); c.closePath(); c.fill();
  c.beginPath(); c.arc(cx,cy,7,0,Math.PI*2); c.fill();
  c.font='600 10px Helvetica, Arial, sans-serif'; c.textAlign='center'; c.fillStyle='#6B7480';
  c.fillText('FRENTE',cx,cy-27); c.fillText('OBSERVADOR',cx,cy+20);
  // fuentes
  sk.markers.forEach(m=>{
    const x=m.x*w, y=m.y*w;
    c.fillStyle=COL[m.tipo]||'#111'; c.beginPath(); c.arc(x,y,14,0,Math.PI*2); c.fill();
    c.fillStyle='#fff'; c.font='700 11px Helvetica, Arial, sans-serif'; c.textBaseline='middle'; c.fillText(m.label,x,y+.5); c.textBaseline='alphabetic';
  });
}
window.addEventListener('resize',size);

/* ---------- interacción ---------- */
const modo=()=>($('[name=modo]:checked',form)||{}).value;
const tipoSel=()=>($('[name=tipoFuente]:checked',form)||{value:'V'}).value;
const pos=e=>{const r=cv.getBoundingClientRect(); return [Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))];};
let drag=null, stroke=null, moved=false, down=null;
cv.addEventListener('pointerdown',e=>{
  cv.setPointerCapture(e.pointerId); const p=pos(e); down=p; moved=false;
  if(modo()==='dibujo'){ stroke=[p]; sk.strokes.push(stroke); return; }
  const hit=sk.markers.slice().reverse().find(m=>Math.hypot(m.x-p[0],m.y-p[1])*W<22);
  drag=hit||null;
});
cv.addEventListener('pointermove',e=>{
  if(!down) return; const p=pos(e);
  if(Math.hypot(p[0]-down[0],p[1]-down[1])*W>4) moved=true;
  if(stroke){ stroke.push(p); draw(); }
  else if(drag&&moved){ drag.x=p[0]; drag.y=p[1]; draw(); }
});
function up(e){
  if(!down) return; const p=pos(e);
  if(stroke){ if(stroke.length>1){ sk.order.push('s'); commit(); } else { sk.strokes.pop(); draw(); } }
  else if(drag){ if(moved) commit(); }
  else if(modo()==='fuente'){
    const m={id:FB.uid().slice(0,8),tipo:tipoSel(),x:p[0],y:p[1]};
    sk.markers.push(m); sk.order.push('m:'+m.id); commit();
    try{navigator.vibrate&&navigator.vibrate(12);}catch(_){}
  }
  down=null; drag=null; stroke=null;
}
cv.addEventListener('pointerup',up);
cv.addEventListener('pointercancel',()=>{down=null;drag=null;if(stroke){sk.strokes.pop();stroke=null;draw();}});

$('#undo').addEventListener('click',()=>{
  const last=sk.order.pop(); if(!last){FB.toast('Nada que deshacer');return;}
  if(last==='s') sk.strokes.pop(); else { const id=last.slice(2); sk.markers=sk.markers.filter(m=>m.id!==id); }
  commit();
});
FB.confirmBtn($('#clear'),()=>{sk={markers:[],strokes:[],order:[]};commit();},'¿Limpiar todo?');

$('#png').addEventListener('click',()=>{
  const S=1200, c=document.createElement('canvas'); c.width=S; c.height=S+90; const x=c.getContext('2d');
  x.fillStyle='#fff'; x.fillRect(0,0,S,S+90); draw(x,S,1);
  x.setTransform(1,0,0,1,0,0); x.fillStyle='#111'; x.font='600 26px Helvetica, Arial'; x.textAlign='left';
  const d=FB.form.serialize(form);
  x.fillText(`${FB.normCodigo(d.codigo)||'Sin código'} · ${FB.lugarDe(d)||''} · ${FB.fechaLarga(d.fecha)}`,24,S+52);
  c.toBlob(b=>FB.entregar(b,`croquis_${FB.normCodigo(d.codigo)||'sin-codigo'}.png`),'image/png');
});

/* ---------- filas de detalle ---------- */
const rows=$('#fuentes-mapa');
function readRows(){ $$('.rep-row',rows).forEach(r=>{ const id=r.dataset.id, d=FB.form.serialize(form).fuentesMapa||[]; const i=+r.dataset.i; if(d[i]) detalles[id]=d[i]; }); }
function renderRows(){
  readRows();
  $('#fm-empty').classList.toggle('hidden',sk.markers.length>0);
  rows.innerHTML=sk.markers.map((m,i)=>{const d=detalles[m.id]||{}; const n=`fuentesMapa.${i}`;
    const rad=(k,vals)=>vals.map(v=>`<label class="chip"><input type="radio" name="${n}.${k}" value="${v}" ${d[k]===v?'checked':''}><span>${v}</span></label>`).join('');
    return `<div class="rep-row" data-id="${m.id}" data-i="${i}">
      <div class="rep-head"><span class="rep-n"><i class="dot" style="background:${COL[m.tipo]}"></i>${FB.esc(m.label)} · ${FB.esc(FB.FUENTE_TIPOS[m.tipo]||'')} · ${FB.direccion(m)}</span><button type="button" class="rep-del" data-delm="${m.id}" aria-label="Quitar fuente">×</button></div>
      <div class="field" style="margin-bottom:.4rem"><input type="text" name="${n}.desc" value="${FB.esc(d.desc||'')}" placeholder="¿Qué es? (ej.: música de local, colectivo 29)"></div>
      <div class="sub"><span class="label">Condición</span><div class="chips sq tight">${rad('mov',['Fija','Móvil'])}</div></div>
      <div class="sub"><span class="label">Distancia</span><div class="chips sq tight">${rad('dist',['Cerca','Media','Lejos'])}</div></div>
    </div>`;}).join('');
}
rows.addEventListener('click',e=>{
  const b=e.target.closest('[data-delm]'); if(!b) return; e.stopPropagation();
  if(!b.dataset.armed){b.dataset.armed='1';b.textContent='?';setTimeout(()=>{if(b.isConnected){delete b.dataset.armed;b.textContent='×';}},2500);return;}
  const id=b.dataset.delm; readRows(); sk.markers=sk.markers.filter(m=>m.id!==id); sk.order=sk.order.filter(o=>o!=='m:'+id); delete detalles[id]; rows.innerHTML=''; commit();
},true);
rows.addEventListener('input',()=>readRows());

renderRows(); size();
if(!hidden.value){ hidden.value=JSON.stringify(sk); }
FB.fotos($('[data-fotos]',form),page.ensureId).render();
FB.wireNext(page.rec);
})();
