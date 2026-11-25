(async function(){
'use strict';
const {$, $$, esc} = FB;
FB.netIndicator($('#net'));

/* Nombre del observador */
const yo=$('#yo'), s=FB.settings.get();
yo.value=s.observador||'';
const hint=()=>{ const ini=FB.iniciales(yo.value); $('#yo-hint').textContent= ini ? `Tus códigos serán ${FB.PREFIJO}-${ini}-01, ${FB.PREFIJO}-${ini}-02…` : 'Se usa para completar las fichas y sugerir tu código (BA-INICIALES-NN).'; };
yo.addEventListener('input',()=>{FB.settings.set({observador:yo.value.trim()});hint();});
hint();

let filtro=s.filtro||'Todos';
await FB.limpiarCartografia();

/* Agrupa fichas: lugar -> código -> {sonora, actividades} */
function agrupar(recs){
  const grupos={};
  recs.forEach(r=>{
    const lug=r.lugar||'Sin lugar', key=r.codigo||('·'+r.id);
    const g=(grupos[lug]=grupos[lug]||{});
    (g[key]=g[key]||{codigo:r.codigo,items:{}}).items[r.tipo]=r;
  });
  return grupos;
}
function ordenLugares(grupos,lugares){ return [...lugares.filter(l=>grupos[l]),...Object.keys(grupos).filter(l=>!lugares.includes(l))]; }

/* Lista por lugar. reg=true: registros del grupo, enlaces de solo lectura y sin crear fichas nuevas */
function htmlLista(grupos,orden,reg){
  return orden.map(l=>{
    const info=FB.lugarInfo(l);
    const regs=Object.values(grupos[l]).map(g=>{
      const any=g.items.sonora||g.items.actividades;
      return {...g,any,ts:(any.fecha||'')+(any.data&&any.data.horaInicio||''),upd:Math.max(...Object.values(g.items).map(x=>x.actualizado||0))};
    }).sort((a,b)=>b.ts.localeCompare(a.ts)||b.upd-a.upd);
    return `<div class="lugar-group">
      <div class="lugar-head"><div><h3>${esc(l)}</h3>${info?`<span class="hom">${esc(info.zona)} · homólogo: ${esc(info.homologo)}</span>`:''}</div><span class="count">${regs.length} ${regs.length===1?'registro':'registros'}</span></div>
      ${regs.map(g=>{
        const d=(g.items.sonora||g.any).data||{};
        const meta=[FB.fechaLarga(g.any.fecha),d.horaInicio,g.any.observador].filter(Boolean).join(' · ');
        const pills=Object.entries(FB.TIPOS).map(([t,T])=>{
          const r=g.items[t];
          if(r) return `<a class="pill done" href="${T.url}?${reg?'reg':'id'}=${r.id}">${T.corto}</a>`;
          if(reg) return '';
          const q=`?codigo=${encodeURIComponent(g.codigo||'')}&lugar=${encodeURIComponent(l==='Sin lugar'?'':l)}`;
          return `<a class="pill todo" href="${T.url}${q}">${T.corto}</a>`;
        }).join('');
        const extra=g.items.sonora&&d.dbProm?` · ${esc(d.dbProm)} dB prom.`:'';
        return `<div class="reg"><div class="reg-top"><span class="reg-code">${esc(g.codigo||'Sin código')}${FB.etiquetaOrigen(g.any.origen)}</span><span class="reg-meta">${esc(meta)}${extra}</span></div><div class="pills">${pills}</div></div>`;
      }).join('')}
    </div>`;
  }).join('');
}

async function render(){
  const recs=(await FB.db.all()).filter(r=>FB.TIPOS[r.tipo]);
  const lugares=await FB.lugaresTodos();
  const grupos=agrupar(recs), orden=ordenLugares(grupos,lugares);

  const nReg=Object.values(grupos).reduce((s,g)=>s+Object.keys(g).length,0);
  $('#stats').innerHTML=`<span><b>${nReg}</b>registros</span><span><b>${recs.length}</b>fichas</span><span><b>${orden.length}</b>lugares</span>`;

  if(filtro!=='Todos'&&!orden.includes(filtro)) filtro='Todos';
  $('#filtro').innerHTML=['Todos',...orden].map(l=>`<label class="chip"><input type="radio" name="filtro" value="${esc(l)}" ${l===filtro?'checked':''}><span>${esc(l)}${l!=='Todos'?` · ${Object.keys(grupos[l]).length}`:''}</span></label>`).join('');

  $('#lista').innerHTML = recs.length
    ? htmlLista(grupos,orden.filter(l=>filtro==='Todos'||l===filtro),false)
    : '<div class="empty">Aún no hay registros en este dispositivo.<br>Empieza con una <a href="ficha-sonora.html">ficha sonora</a>.</div>';

  /* aviso de respaldo */
  const last=FB.settings.get().ultimoRespaldo||0;
  const pend=recs.filter(r=>(r.actualizado||0)>last).length;
  $('#respaldo-aviso').innerHTML = !recs.length ? '' : pend
    ? `<div class="notice">${pend} ${pend===1?'ficha nueva o modificada':'fichas nuevas o modificadas'} desde el último respaldo${last?` (${new Date(last).toLocaleString('es-CL',{dateStyle:'short',timeStyle:'short'})})`:''}. Cuando tengas conexión, haz un respaldo y envíalo al grupo.</div>`
    : `<div class="notice ok">Todo respaldado · ${new Date(last).toLocaleString('es-CL',{dateStyle:'short',timeStyle:'short'})}</div>`;
}

/* Registros recopilados en Buenos Aires (archivo del grupo, solo lectura) */
async function renderRegistros(){
  const regs=await FB.registrosBA();
  if(!regs.length){ $('#lista-ba').innerHTML='<div class="empty">No se pudieron cargar los registros.</div>'; return; }
  const lugares=await FB.lugaresTodos(); const g=agrupar(regs);
  const porCodigo={}; regs.forEach(r=>{ porCodigo[r.codigo]=r.origen||'terreno'; });
  const n=o=>Object.values(porCodigo).filter(x=>x===o).length;
  $('#stats-ba').innerHTML=`<span><b>${Object.keys(porCodigo).length}</b>registros</span><span><b>${n('terreno')}</b>terreno</span><span><b>${n('reconstruido')}</b>reconstruidos</span><span><b>${Object.keys(g).length}</b>lugares</span>`;
  $('#lista-ba').innerHTML=htmlLista(g,ordenLugares(g,lugares),true);
}

$('#filtro').addEventListener('change',e=>{ filtro=e.target.value; FB.settings.set({filtro}); render(); });

/* Exportaciones */
const stamp=()=>{const d=new Date();return `${d.getFullYear()}${FB.pad(d.getMonth()+1)}${FB.pad(d.getDate())}-${FB.pad(d.getHours())}${FB.pad(d.getMinutes())}`;};
const quien=()=>FB.iniciales(FB.settings.get().observador)||'grupo';
async function csv(fn,cols,nombre,fuente){
  const recs=fuente?await fuente():(await FB.db.all()).filter(r=>FB.TIPOS[r.tipo]);
  if(!recs.length){FB.toast('No hay fichas para exportar');return;}
  const rows=fn(recs); if(!rows.length){FB.toast('No hay datos de ese tipo todavía');return;}
  const r=await FB.entregar(new Blob([FB.toCSV(rows,cols)],{type:'text/csv;charset=utf-8'}),`${nombre}_${stamp()}.csv`);
  if(r!=='cancelado') FB.toast(`${rows.length} filas exportadas`);
}
$('#exp-general').addEventListener('click',()=>csv(FB.tablaGeneral,FB.COLS_GENERAL,`tabla-general_BA_${quien()}`));
$('#exp-fuentes').addEventListener('click',()=>csv(FB.tablaFuentes,FB.COLS_FUENTES,`fuentes_BA_${quien()}`));
$('#exp-conteos').addEventListener('click',()=>csv(FB.tablaConteos,FB.COLS_CONTEOS,`conteos_BA_${quien()}`));
$('#exp-ba').addEventListener('click',()=>csv(FB.tablaGeneral,FB.COLS_GENERAL,'tabla-general_BA_registros-grupo2',FB.registrosBA));
$('#exp-json').addEventListener('click',async()=>{
  const recs=await FB.db.all(); if(!recs.length){FB.toast('No hay fichas para respaldar');return;}
  const data=await FB.respaldo();
  const r=await FB.entregar(new Blob([JSON.stringify(data)],{type:'application/json'}),`respaldo-fichas-BA_${quien()}_${stamp()}.json`);
  if(r!=='cancelado'){ FB.settings.set({ultimoRespaldo:Date.now()}); FB.toast('Respaldo listo'); render(); }
});
$('#imp').addEventListener('change',async e=>{
  let tot={nuevas:0,act:0,igual:0};
  for(const f of e.target.files){
    try{ const r=await FB.importar(JSON.parse(await f.text())); tot.nuevas+=r.nuevas; tot.act+=r.act; tot.igual+=r.igual; }
    catch(err){ FB.toast(`${f.name}: ${err.message}`,4000); }
  }
  e.target.value='';
  await FB.limpiarCartografia();
  if(tot.nuevas||tot.act||tot.igual) FB.toast(`Importadas: ${tot.nuevas} nuevas · ${tot.act} actualizadas · ${tot.igual} sin cambios`,3500);
  render();
});

/* Estado del almacenamiento */
(async()=>{
  try{
    const p=navigator.storage&&await navigator.storage.persisted();
    const est=navigator.storage&&await navigator.storage.estimate();
    const mb=est?(est.usage/1048576).toFixed(1):'?';
    $('#storage').textContent=`Almacenamiento en este dispositivo: ${mb} MB usados · ${p?'protegido contra borrado automático':'el navegador podría liberar espacio si falta; haz respaldos seguido'}.`;
  }catch(e){}
})();

render(); renderRegistros();
window.addEventListener('pageshow',e=>{ if(e.persisted) render(); });
})();
