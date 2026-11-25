/* Núcleo compartido: base de datos local (IndexedDB), lugares, utilidades,
   formularios con autoguardado, cronómetro, fotos y exportación. */
(function(){
'use strict';
const FB = window.FB = {};

/* ================= Configuración ================= */
FB.CIUDAD = 'Buenos Aires';
FB.PREFIJO = 'BA';
FB.LUGARES = [
  {nombre:'Puente de la Mujer', zona:'Puerto Madero', homologo:'Muelle Prat'},
  {nombre:'Plaza de Mayo',      zona:'Monserrat',     homologo:'Plaza Sotomayor'},
  {nombre:'Calle Defensa',      zona:'San Telmo',     homologo:'Calle Serrano'},
  {nombre:'Plaza Dorrego',      zona:'San Telmo',     homologo:'Plaza Echaurren'}
];
FB.TIPOS = {
  sonora:      {nombre:'Ficha sonora',            corto:'Sonora',       url:'ficha-sonora.html',      n:'01'},
  actividades: {nombre:'Actividades humanas',     corto:'Actividades',  url:'ficha-actividades.html', n:'02'}
};
FB.REG_URL = 'data/registros-ba.json';
/* Origen de cada registro */
FB.ORIGEN = {
  terreno:      {corto:'Terreno',      texto:'Registro medido en terreno.'},
  reconstruido: {corto:'Reconstruido', texto:'Registro reconstruido: la observación no se alcanzó a completar en terreno en ese momento; se completó después a partir de lo vivido en el lugar, de la experiencia previa del grupo y de otros datos (referencias publicadas). Sirve para comparar, no como medición.'}
};
FB.FUENTE_TIPOS = {H:'Humana',V:'Vehicular',C:'Comercial',N:'Natural',M:'Mecánica',O:'Otra'};
FB.FUENTE_COLORES = {H:'#B3624E',V:'#0B294A',C:'#C9962B',N:'#2E7D5B',M:'#6B7480',O:'#8A5BA6'};

/* ================= Utilidades ================= */
FB.$ = (s,el=document)=>el.querySelector(s);
FB.$$ = (s,el=document)=>[...el.querySelectorAll(s)];
FB.uid = ()=> (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)+Math.random().toString(36).slice(2));
FB.pad = n=>String(n).padStart(2,'0');
FB.hoy = ()=>{const d=new Date();return `${d.getFullYear()}-${FB.pad(d.getMonth()+1)}-${FB.pad(d.getDate())}`};
FB.hora = (d=new Date())=>`${FB.pad(d.getHours())}:${FB.pad(d.getMinutes())}`;
FB.fechaLarga = iso=>{ if(!iso) return ''; const [y,m,d]=iso.split('-'); return `${d}/${m}/${y}`; };
FB.esc = s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
FB.normCodigo = s=>String(s||'').trim().toUpperCase().replace(/\s+/g,'');
FB.iniciales = nombre=>String(nombre||'').trim().split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0]).join('').normalize('NFD').replace(/[̀-ͯ]/g,'').toUpperCase();
FB.params = new URLSearchParams(location.search);

FB.toast = (msg,ms=2200)=>{
  let t=FB.$('.toast'); if(!t){t=document.createElement('div');t.className='toast';t.setAttribute('role','status');document.body.appendChild(t);}
  t.textContent=msg; t.classList.add('show'); clearTimeout(t._h); t._h=setTimeout(()=>t.classList.remove('show'),ms);
};

/* Botón con confirmación en dos toques (no usamos confirm()) */
FB.confirmBtn = (btn,fn,label='¿Seguro? Toca otra vez')=>{
  const orig=btn.textContent; let armed=false, h;
  btn.addEventListener('click',()=>{
    if(!armed){armed=true;btn.textContent=label;h=setTimeout(()=>{armed=false;btn.textContent=orig;},3000);return;}
    clearTimeout(h);armed=false;btn.textContent=orig;fn();
  });
};

/* ================= Ajustes (localStorage) ================= */
FB.settings = {
  get(){ try{return JSON.parse(localStorage.getItem('fb-settings')||'{}')}catch(e){return {}} },
  set(patch){ try{const s={...FB.settings.get(),...patch};localStorage.setItem('fb-settings',JSON.stringify(s));return s}catch(e){return patch} }
};

/* ================= IndexedDB ================= */
let _db;
function openDB(){
  if(_db) return Promise.resolve(_db);
  return new Promise((res,rej)=>{
    const r=indexedDB.open('fichas-ba',1);
    r.onupgradeneeded=()=>{
      const db=r.result;
      if(!db.objectStoreNames.contains('fichas')){
        const s=db.createObjectStore('fichas',{keyPath:'id'});
        s.createIndex('lugar','lugar'); s.createIndex('codigo','codigo'); s.createIndex('tipo','tipo');
      }
      if(!db.objectStoreNames.contains('media')){
        const m=db.createObjectStore('media',{keyPath:'id'}); m.createIndex('fichaId','fichaId');
      }
    };
    r.onsuccess=()=>{_db=r.result;res(_db)};
    r.onerror=()=>rej(r.error);
  });
}
const req=r=>new Promise((res,rej)=>{r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
async function os(name,mode='readonly'){const db=await openDB();return db.transaction(name,mode).objectStore(name);}

FB.db = {
  get: async id=>req((await os('fichas')).get(id)),
  all: async ()=>req((await os('fichas')).getAll()),
  put: async rec=>req((await os('fichas','readwrite')).put(rec)),
  async del(id){
    const db=await openDB();
    return new Promise((res,rej)=>{
      const t=db.transaction(['fichas','media'],'readwrite');
      t.objectStore('fichas').delete(id);
      const idx=t.objectStore('media').index('fichaId');
      idx.openCursor(IDBKeyRange.only(id)).onsuccess=e=>{const c=e.target.result;if(c){c.delete();c.continue();}};
      t.oncomplete=()=>res(); t.onerror=()=>rej(t.error);
    });
  },
  media:{
    put: async m=>req((await os('media','readwrite')).put(m)),
    del: async id=>req((await os('media','readwrite')).delete(id)),
    byFicha: async fid=>req((await os('media')).index('fichaId').getAll(fid)),
    all: async ()=>req((await os('media')).getAll())
  }
};

/* La cartografía no se usó en Argentina: se borran las fichas de ese tipo que queden guardadas */
FB.limpiarCartografia = async ()=>{
  try{ const old=(await FB.db.all()).filter(r=>r.tipo==='cartografia'); for(const r of old) await FB.db.del(r.id); return old.length; }catch(e){ return 0; }
};

/* Registros recopilados en Buenos Aires (archivo del grupo, solo lectura) */
let _reg;
FB.registrosBA = async ()=>{
  if(_reg) return _reg;
  try{ const r=await fetch(FB.REG_URL); const j=await r.json(); _reg=(j.fichas||[]).filter(f=>FB.TIPOS[f.tipo]); }
  catch(e){ _reg=[]; }
  return _reg;
};
FB.etiquetaOrigen = o=>FB.ORIGEN[o]?`<span class="origen ${o}">${FB.ORIGEN[o].corto}</span>`:'';

/* Pide al navegador que no borre los datos si falta espacio */
FB.persist = async ()=>{
  try{ if(navigator.storage&&navigator.storage.persist){ if(await navigator.storage.persisted()) return true; return await navigator.storage.persist(); } }catch(e){}
  return false;
};

/* ================= Lugares (categorías) ================= */
FB.lugarInfo = nombre=>FB.LUGARES.find(l=>l.nombre.toLowerCase()===String(nombre||'').toLowerCase());
FB.lugaresTodos = async ()=>{
  const base=FB.LUGARES.map(l=>l.nombre);
  const recs=await FB.db.all();
  const extra=[...new Set(recs.map(r=>r.lugar).filter(Boolean))].filter(n=>!base.some(b=>b.toLowerCase()===n.toLowerCase())).sort((a,b)=>a.localeCompare(b,'es'));
  return [...base,...extra];
};

/* ================= Rutas de objetos (a.0.b) ================= */
function setPath(o,path,v){
  const ks=path.split('.'); let cur=o;
  ks.forEach((k,i)=>{
    if(i===ks.length-1){cur[k]=v;return;}
    if(cur[k]==null) cur[k]=/^\d+$/.test(ks[i+1])?[]:{};
    cur=cur[k];
  });
}
function getPath(o,path){return path.split('.').reduce((c,k)=>c==null?undefined:c[k],o);}
FB.getPath=getPath;

/* ================= Formularios ================= */
FB.form = {
  serialize(form){
    const out={};
    for(const el of form.elements){
      if(!el.name||el.dataset.skip!=null) continue;
      if(el.type==='radio'){ if(el.checked) setPath(out,el.name,el.value); else if(getPath(out,el.name)===undefined) setPath(out,el.name,''); continue; }
      if(el.type==='checkbox'){
        if(el.value!=='on'){ const a=getPath(out,el.name)||[]; if(el.checked) a.push(el.value); setPath(out,el.name,a); }
        else setPath(out,el.name,el.checked);
        continue;
      }
      if(el.type==='file'||el.type==='button'||el.type==='submit') continue;
      setPath(out,el.name,el.value);
    }
    // filas vacías de repetibles fuera
    return out;
  },
  fill(form,data){
    FB.$$('[data-repeat]',form).forEach(c=>{
      const key=c.dataset.repeat, arr=getPath(data,key)||[];
      const min=+(c.dataset.min||0);
      FB.$$(':scope > .rep-row',c).forEach(r=>r.remove());
      for(let i=0;i<Math.max(arr.length,min);i++) FB.form.addRow(c,false);
    });
    for(const el of form.elements){
      if(!el.name||el.dataset.skip!=null||el.type==='file') continue;
      const v=getPath(data,el.name);
      if(el.type==='radio') el.checked=(v===el.value);
      else if(el.type==='checkbox') el.checked = el.value!=='on' ? Array.isArray(v)&&v.includes(el.value) : !!v;
      else if(v!==undefined) el.value=v;
    }
  },
  renumber(c){
    const key=c.dataset.repeat;
    FB.$$(':scope > .rep-row',c).forEach((row,i)=>{
      FB.$$('[data-k]',row).forEach(el=>{el.name=`${key}.${i}.${el.dataset.k}`;});
      const n=FB.$('.rep-n',row); if(n) n.textContent=(c.dataset.label||'')+' '+FB.pad(i+1);
    });
  },
  addRow(c,focus=true){
    const tpl=document.getElementById(c.dataset.template);
    const node=tpl.content.firstElementChild.cloneNode(true);
    c.appendChild(node); FB.form.renumber(c);
    if(focus){const f=FB.$('input[type=text],textarea',node); f&&f.focus();}
    return node;
  },
  /* activa botones "agregar" y "quitar" de filas repetibles */
  wireRepeats(form,onChange){
    FB.$$('[data-add]',form).forEach(b=>b.addEventListener('click',()=>{
      const c=FB.$(`[data-repeat="${b.dataset.add}"]`,form); FB.form.addRow(c); onChange();
    }));
    form.addEventListener('click',e=>{
      const del=e.target.closest('.rep-del'); if(!del) return;
      const row=del.closest('.rep-row'), c=row.parentElement;
      if(del.dataset.armed){row.remove();FB.form.renumber(c);onChange();return;}
      del.dataset.armed='1'; del.textContent='?'; del.title='Toca otra vez para quitar';
      setTimeout(()=>{if(del.isConnected){delete del.dataset.armed;del.textContent='×';}},2500);
    });
  }
};

/* ================= Lugar: chips + "otro" ================= */
FB.renderLugares = async (cont,form)=>{
  const lugares=await FB.lugaresTodos();
  cont.innerHTML = `<div class="chips">${lugares.map(l=>{const i=FB.lugarInfo(l);
      return `<label class="chip"><input type="radio" name="lugar" value="${FB.esc(l)}"><span>${FB.esc(l)}</span></label>`;}).join('')}</div>
    <div class="field" style="margin-top:.7rem"><input type="text" name="lugarOtro" placeholder="Otro lugar (se crea como nueva categoría)" autocomplete="off"></div>
    <p class="hint small muted lugar-hom"></p>`;
  const hom=FB.$('.lugar-hom',cont);
  const upd=()=>{const v=FB.form.serialize(form).lugar; const i=FB.lugarInfo(v); hom.textContent=i?`${i.zona} · homólogo en Valparaíso: ${i.homologo}`:'';};
  cont.addEventListener('change',e=>{
    if(e.target.name==='lugar'){FB.$('[name=lugarOtro]',cont).value='';}
    upd();
  });
  FB.$('[name=lugarOtro]',cont).addEventListener('input',e=>{ if(e.target.value.trim()) FB.$$('[name=lugar]',cont).forEach(r=>r.checked=false); upd(); });
  cont._upd=upd;
};
FB.lugarDe = data=>(data.lugar||'').trim()||(data.lugarOtro||'').trim();

/* ================= Cronómetro de 10 minutos ================= */
FB.timer = function(el,form,onChange){
  const DUR=600, start=FB.$('[name=timerStart]',form), end=FB.$('[name=timerEnd]',form);
  const clock=FB.$('.timer-clock',el), bars=FB.$$('.timer-bar i',el), lbl=FB.$('.timer-int',el);
  const bStart=FB.$('[data-t=start]',el), bStop=FB.$('[data-t=stop]',el), bReset=FB.$('[data-t=reset]',el);
  let h, notified=false;
  const api={ interval:()=>-1, running:()=>false, onTick:null };
  const elapsed=()=>{const s=+start.value; if(!s) return 0; const e=+end.value||Date.now(); return Math.max(0,(e-s)/1000);};
  function setIf(name,val){const f=FB.$(`[name=${name}]`,form); if(f&&!f.value){f.value=val;}}
  function render(){
    const t=elapsed(), run=!!+start.value&&!+end.value;
    const shown=Math.min(t,DUR*3);
    clock.textContent=`${FB.pad(Math.floor(shown/60))}:${FB.pad(Math.floor(shown%60))}`;
    const cur=Math.min(4,Math.floor(t/120));
    bars.forEach((b,i)=>{const fill=Math.max(0,Math.min(1,(t-i*120)/120)); b.firstElementChild.style.width=(fill*100)+'%'; b.classList.toggle('cur',run&&i===cur&&t<DUR);});
    el.classList.toggle('running',run); el.classList.toggle('done',t>=DUR);
    lbl.textContent = !+start.value ? 'Toca iniciar al comenzar la observación' : t>=DUR ? 'Observación de 10 min completa' : run ? `Intervalo ${FB.pad(cur*2)}–${FB.pad(cur*2+2)} min` : 'En pausa / detenido';
    const ro=FB.page&&FB.page.reg;
    bStart.classList.toggle('hidden',ro||!!+start.value); bStop.classList.toggle('hidden',ro||!run); bReset.classList.toggle('hidden',ro||!+start.value||run);
    api.interval=()=> (+start.value && t<DUR) ? cur : -1;
    api.running=()=>run;
    if(run&&t>=DUR&&!notified&&!ro){
      notified=true; try{navigator.vibrate&&navigator.vibrate([200,100,200]);}catch(e){}
      end.value=String(+start.value+DUR*1000);
      setIf('horaTermino',FB.hora(new Date(+end.value)));
      const d=FB.$('[name=duracion]',form); if(d&&!d.value) d.value='10';
      FB.toast('10 minutos completos'); onChange();
    }
    api.onTick&&api.onTick(api);
  }
  bStart.addEventListener('click',()=>{
    start.value=String(Date.now()); end.value=''; notified=false;
    setIf('horaInicio',FB.hora());
    const fe=FB.$('[name=fecha]',form); if(fe&&!fe.value) fe.value=FB.hoy();
    onChange(); render();
  });
  bStop.addEventListener('click',()=>{
    end.value=String(Date.now()); setIf('horaTermino',FB.hora());
    const d=FB.$('[name=duracion]',form); if(d&&!d.value) d.value=String(Math.max(1,Math.round(elapsed()/60)));
    onChange(); render();
  });
  FB.confirmBtn(bReset,()=>{start.value='';end.value='';notified=false;onChange();render();},'¿Reiniciar?');
  api.refresh=()=>{notified=!!+end.value; render();};
  h=setInterval(render,250); render();
  return api;
};

/* ================= Fotos ================= */
async function compress(file,max=1600,q=.78){
  try{
    const bmp=await createImageBitmap(file,{imageOrientation:'from-image'});
    const s=Math.min(1,max/Math.max(bmp.width,bmp.height));
    const c=document.createElement('canvas'); c.width=Math.round(bmp.width*s); c.height=Math.round(bmp.height*s);
    c.getContext('2d').drawImage(bmp,0,0,c.width,c.height);
    return await new Promise(r=>c.toBlob(b=>r(b||file),'image/jpeg',q));
  }catch(e){ return file; }
}
FB.fotos = function(cont,ensureId){
  const grid=FB.$('.fotos',cont), input=FB.$('input[type=file]',cont);
  const urls=[];
  async function render(){
    urls.splice(0).forEach(u=>URL.revokeObjectURL(u));
    const id=FB.page&&FB.page.id; if(!id){grid.innerHTML='';return;}
    const ms=(await FB.db.media.byFicha(id)).sort((a,b)=>a.creado-b.creado);
    grid.innerHTML='';
    ms.forEach(m=>{const u=URL.createObjectURL(m.blob);urls.push(u);
      const d=document.createElement('div');d.className='foto';
      d.innerHTML=`<img src="${u}" alt="Foto del registro"><button type="button" aria-label="Quitar foto">×</button>`;
      FB.confirmBtn(FB.$('button',d),async()=>{await FB.db.media.del(m.id);render();FB.page.touch();},'?');
      grid.appendChild(d);});
  }
  input.addEventListener('change',async()=>{
    const files=[...input.files]; if(!files.length) return;
    const id=await ensureId();
    for(const f of files){ const blob=await compress(f); await FB.db.media.put({id:FB.uid(),fichaId:id,blob,tipo:blob.type,nombre:f.name,creado:Date.now()}); }
    input.value=''; FB.toast(files.length>1?`${files.length} fotos guardadas`:'Foto guardada'); render(); FB.page.touch();
  });
  return {render};
};

/* ================= Controlador de página de ficha =================
   Crea el registro al primer cambio, autoguarda con espera corta y
   guarda inmediatamente al salir de la página. */
FB.ficha = async function({tipo, form, onLoad, onSerialize, onAfterSave}){
  const status=FB.$('.save-status');
  const setStatus=(t,cls='')=>{if(status){status.textContent=t;status.className='save-status '+cls;}};
  const regId=FB.params.get('reg');
  const page=FB.page={id:FB.params.get('id')||null, rec:null, dirty:false, reg:!!regId};
  if(regId){
    page.rec=(await FB.registrosBA()).find(r=>r.id===regId)||null;
    if(page.rec){
      FB.form.fill(form,page.rec.data||{});
      FB.$$('input,textarea,select,button',form).forEach(el=>el.disabled=true);
      FB.$$('[data-timer] button,[data-delete],[data-add],.file-btn').forEach(el=>el.classList.add('hidden'));
      const o=FB.ORIGEN[page.rec.origen]||FB.ORIGEN.terreno;
      const n=document.createElement('div'); n.className=page.rec.origen==='reconstruido'?'notice':'notice ok'; n.style.marginTop='1rem';
      n.textContent=`Registro recopilado en Buenos Aires · solo lectura. ${o.texto}`;
      FB.$('main').prepend(n);
      setStatus('Solo lectura');
      page.touch=()=>{}; page.save=async()=>{}; page.ensureId=async()=>null;
      onLoad&&await onLoad(page.rec);
      return page;
    }
  }
  let timer;

  async function save(){
    clearTimeout(timer);
    if(!page.dirty) return;
    page.dirty=false;
    try{
      const data=FB.form.serialize(form);
      onSerialize&&onSerialize(data);
      const now=Date.now();
      if(!page.rec){ page.id=page.id||FB.uid(); page.rec={id:page.id,tipo,creado:now}; history.replaceState(null,'',`?id=${page.id}`); FB.persist(); }
      Object.assign(page.rec,{
        tipo, data, actualizado:now,
        codigo:FB.normCodigo(data.codigo), lugar:FB.lugarDe(data),
        observador:(data.observador||'').trim(), fecha:data.fecha||''
      });
      await FB.db.put(page.rec);
      if(page.rec.observador) FB.settings.set({observador:page.rec.observador});
      setStatus('Guardado '+FB.hora(new Date(now))+'·'+FB.pad(new Date(now).getSeconds()),'saved');
      onAfterSave&&onAfterSave(page.rec);
    }catch(e){ page.dirty=true; setStatus('Error al guardar','error'); console.error(e); }
  }
  page.touch=()=>{ page.dirty=true; setStatus('Guardando…'); clearTimeout(timer); timer=setTimeout(save,450); };
  page.save=save;
  page.ensureId=async()=>{ if(!page.rec){page.dirty=true; await save();} return page.id; };

  const onEdit=e=>{ if(e.target&&e.target.dataset&&e.target.dataset.skip!=null) return; page.touch(); };
  form.addEventListener('input',onEdit);
  form.addEventListener('change',onEdit);
  form.addEventListener('submit',e=>e.preventDefault());
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden') save();});
  window.addEventListener('pagehide',save);

  if(page.id){
    page.rec=await FB.db.get(page.id);
    if(!page.rec){ page.id=null; history.replaceState(null,'',location.pathname); FB.toast('No se encontró esa ficha; se abrió una nueva'); }
  }
  if(page.rec){ FB.form.fill(form,page.rec.data||{}); setStatus('Abierta · guardado automático'); }
  else { FB.form.fill(form,{}); setStatus('Nueva · se guarda sola'); }
  onLoad&&await onLoad(page.rec);

  // eliminar
  const del=FB.$('[data-delete]');
  if(del) FB.confirmBtn(del,async()=>{ if(page.id) await FB.db.del(page.id); page.dirty=false; location.href='index.html'; },'¿Eliminar? Toca otra vez');
  return page;
};

/* Sugerencia de código BA-INICIALES-NN */
FB.sugerirCodigo = async observador=>{
  const ini=FB.iniciales(observador)||'XX';
  const base=`${FB.PREFIJO}-${ini}-`;
  const recs=(await FB.db.all()).filter(r=>r.tipo==='sonora'&&r.codigo.startsWith(base));
  const max=recs.reduce((m,r)=>Math.max(m,parseInt(r.codigo.slice(base.length))||0),0);
  return base+FB.pad(max+1);
};

/* Lista de fichas sonoras para enlazar (datalist) y autocompletar */
FB.enlazarSonora = async (form,input)=>{
  const recs=(await FB.db.all()).filter(r=>r.tipo==='sonora'&&r.codigo).sort((a,b)=>b.actualizado-a.actualizado);
  const dl=document.getElementById(input.getAttribute('list'));
  if(dl) dl.innerHTML=recs.map(r=>`<option value="${FB.esc(r.codigo)}">${FB.esc(r.lugar||'')} · ${FB.fechaLarga(r.fecha)}</option>`).join('');
  const fill=()=>{
    const r=recs.find(x=>x.codigo===FB.normCodigo(input.value)); if(!r) return false;
    const d=r.data||{}; let changed=false;
    const set=(n,v)=>{const f=FB.$(`[name=${n}]`,form); if(f&&!f.value&&v){f.value=v;changed=true;}};
    set('observador',d.observador); set('fecha',d.fecha); set('horaInicio',d.horaInicio); set('horaTermino',d.horaTermino);
    const lug=r.lugar; if(lug && !FB.lugarDe(FB.form.serialize(form))){
      const radio=FB.$$('[name=lugar]',form).find(x=>x.value.toLowerCase()===lug.toLowerCase());
      if(radio) radio.checked=true; else FB.$('[name=lugarOtro]',form).value=lug;
      const c=FB.$('[data-lugares]',form); c&&c._upd&&c._upd(); changed=true;
    }
    return changed;
  };
  input.addEventListener('change',()=>{ if(fill()) { FB.toast('Datos copiados desde la ficha sonora'); FB.page&&FB.page.touch(); } });
  return {fill, recs};
};

/* Prefill desde la URL (?codigo=&lugar=) para fichas nuevas */
FB.prefill = form=>{
  if(FB.page&&FB.page.rec) return;
  const c=FB.params.get('codigo'), l=FB.params.get('lugar');
  if(c){const f=FB.$('[name=codigo]',form); if(f) f.value=c;}
  if(l){
    const radio=FB.$$('[name=lugar]',form).find(x=>x.value.toLowerCase()===l.toLowerCase());
    if(radio) radio.checked=true; else { const o=FB.$('[name=lugarOtro]',form); if(o) o.value=l; }
    const cont=FB.$('[data-lugares]',form); cont&&cont._upd&&cont._upd();
  }
  const obs=FB.$('[name=observador]',form), s=FB.settings.get();
  if(obs&&!obs.value&&s.observador) obs.value=s.observador;
  const fe=FB.$('[name=fecha]',form); if(fe&&!fe.value) fe.value=FB.hoy();
};

/* ================= Exportación ================= */
function csvCell(v){ if(v==null) return ''; if(Array.isArray(v)) v=v.join(' | '); v=String(v); return /[",\n\r;]/.test(v)?`"${v.replace(/"/g,'""')}"`:v; }
FB.toCSV = (rows,cols)=>'﻿'+[cols.map(c=>csvCell(c[0])).join(','),...rows.map(r=>cols.map(c=>csvCell(typeof c[1]==='function'?c[1](r):r[c[1]])).join(','))].join('\r\n');

FB.entregar = async (blob,filename)=>{
  const file=new File([blob],filename,{type:blob.type});
  try{
    if(navigator.canShare&&navigator.canShare({files:[file]})&&matchMedia('(pointer:coarse)').matches){
      await navigator.share({files:[file],title:filename}); return 'compartido';
    }
  }catch(e){ if(e&&e.name==='AbortError') return 'cancelado'; }
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=filename;
  document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},4000);
  return 'descargado';
};

const num=v=>{ if(v===''||v==null) return ''; const n=parseFloat(String(v).replace(',','.')); return isNaN(n)?String(v):n; };
const suma=(arr,k)=>(arr||[]).reduce((s,x)=>s+(parseInt(x&&x[k])||0),0);

/* Tabla general: una fila por código de registro, combinando las 3 fichas */
FB.tablaGeneral = recs=>{
  const by={};
  recs.filter(r=>FB.TIPOS[r.tipo]).forEach(r=>{const k=r.codigo||('sin-codigo-'+r.id); (by[k]=by[k]||{codigo:r.codigo})[r.tipo]=r;});
  return Object.values(by).map(g=>{
    const s=g.sonora&&g.sonora.data||{}, a=g.actividades&&g.actividades.data||{};
    const any=g.sonora||g.actividades;
    const lugar=any.lugar; const info=FB.lugarInfo(lugar)||{};
    const fuentes=(s.fuentes||[]).filter(f=>f&&f.sonido);
    const tipos=[...new Set(fuentes.map(f=>f.tipo).filter(Boolean))];
    return {
      ciudad:FB.CIUDAD, codigo:g.codigo||'', fecha:any.fecha||'', horaInicio:s.horaInicio||a.horaInicio||'', horaTermino:s.horaTermino||a.horaTermino||'',
      lugar, zona:info.zona||'', homologo:info.homologo||'', observador:any.observador||'',
      referencia:s.referencia||'', tipoEspacio:s.tipoEspacio||[], clima:s.clima||'', viento:s.viento||'',
      predominante:s.predominante||'', dbMin:num(s.dbMin), dbProm:num(s.dbProm), dbMax:num(s.dbMax), equipo:s.equipo||'', noMedido:s.noMedido?'sí':'',
      flujoPersonas:s.flujoPersonas||'', flujoVehicular:s.flujoVehicular||'',
      intensidad:s.evIntensidad||'', diversidad:s.evDiversidad||'', agrado:s.evAgrado||'', facilidad:s.evFacilidad||'',
      nFuentes:fuentes.length||'', tiposFuentes:tipos.join(' '), eventos:suma(fuentes,'eventos')||'',
      peatones:a.conteo?suma(a.conteo,'peatones'):'', vehiculos:a.conteo?suma(a.conteo,'vehiculos'):'',
      actividades:[...(a.actividades||[]),a.actividadOtra].filter(Boolean),
      fichas:['sonora','actividades'].filter(t=>g[t]).join(' '),
      origen:any.origen||'terreno'
    };
  }).sort((x,y)=>(x.fecha+x.horaInicio).localeCompare(y.fecha+y.horaInicio));
};
FB.COLS_GENERAL=[['Ciudad','ciudad'],['Código','codigo'],['Fecha','fecha'],['Hora inicio','horaInicio'],['Hora término','horaTermino'],['Lugar','lugar'],['Zona','zona'],['Homólogo Valparaíso','homologo'],['Observador/a','observador'],['Referencia','referencia'],['Tipo de espacio','tipoEspacio'],['Clima','clima'],['Viento','viento'],['Fuente predominante','predominante'],['dB mín','dbMin'],['dB prom','dbProm'],['dB máx','dbMax'],['Equipo / app','equipo'],['No se midió','noMedido'],['Flujo personas','flujoPersonas'],['Flujo vehicular','flujoVehicular'],['Intensidad (1-5)','intensidad'],['Diversidad (1-5)','diversidad'],['Agrado (1-5)','agrado'],['Facilidad distinguir (1-5)','facilidad'],['N.º fuentes','nFuentes'],['Tipos de fuentes','tiposFuentes'],['N.º eventos','eventos'],['Peatones (10 min)','peatones'],['Vehículos (10 min)','vehiculos'],['Actividades','actividades'],['Fichas completadas','fichas'],['Origen','origen']];

FB.tablaFuentes = recs=>recs.filter(r=>r.tipo==='sonora').flatMap(r=>(r.data.fuentes||[]).filter(f=>f&&f.sonido).map((f,i)=>({
  ciudad:FB.CIUDAD,codigo:r.codigo,fecha:r.fecha,lugar:r.lugar,observador:r.observador,n:i+1,sonido:f.sonido,tipo:f.tipo||'',tipoNombre:FB.FUENTE_TIPOS[f.tipo]||'',intensidad:f.intensidad||'',eventos:num(f.eventos),patron:f.patron||'',predominante:(r.data.predominante&&r.data.predominante===f.sonido)?'sí':''})));
FB.COLS_FUENTES=[['Ciudad','ciudad'],['Código','codigo'],['Fecha','fecha'],['Lugar','lugar'],['Observador/a','observador'],['N.º','n'],['Sonido / fuente','sonido'],['Tipo','tipo'],['Tipo (nombre)','tipoNombre'],['Intensidad (1-5)','intensidad'],['N.º eventos / min','eventos'],['Patrón','patron'],['Predominante','predominante']];

FB.tablaConteos = recs=>recs.filter(r=>r.tipo==='actividades').flatMap(r=>(r.data.conteo||[]).map((c,i)=>({
  ciudad:FB.CIUDAD,codigo:r.codigo,fecha:r.fecha,lugar:r.lugar,observador:r.observador,intervalo:`${FB.pad(i*2)}–${FB.pad(i*2+2)} min`,peatones:num(c&&c.peatones),vehiculos:num(c&&c.vehiculos),nota:c&&c.nota||''})));
FB.COLS_CONTEOS=[['Ciudad','ciudad'],['Código','codigo'],['Fecha','fecha'],['Lugar','lugar'],['Observador/a','observador'],['Intervalo','intervalo'],['Peatones','peatones'],['Vehículos','vehiculos'],['Nota','nota']];

/* Respaldo completo (incluye fotos) */
const b64=blob=>new Promise(r=>{const fr=new FileReader();fr.onload=()=>r(fr.result);fr.readAsDataURL(blob);});
FB.respaldo = async ()=>{
  const fichas=await FB.db.all(), media=await FB.db.media.all();
  const m=[]; for(const x of media) m.push({id:x.id,fichaId:x.fichaId,tipo:x.tipo,nombre:x.nombre,creado:x.creado,data:await b64(x.blob)});
  return {app:'fichas-sonoras-ba',version:1,exportado:new Date().toISOString(),observador:FB.settings.get().observador||'',fichas,media:m};
};
FB.importar = async json=>{
  if(!json||json.app!=='fichas-sonoras-ba'||!Array.isArray(json.fichas)) throw new Error('El archivo no es un respaldo de esta app');
  let nuevas=0,act=0,igual=0;
  for(const x of json.fichas.filter(x=>FB.TIPOS[x.tipo])){
    const f=(json.origen&&!x.origen)?{...x,origen:json.origen}:x;
    const cur=await FB.db.get(f.id);
    if(!cur){await FB.db.put(f);nuevas++;}
    else if((f.actualizado||0)>(cur.actualizado||0)){await FB.db.put(f);act++;}
    else igual++;
  }
  const have=new Set((await FB.db.media.all()).map(x=>x.id));
  for(const x of (json.media||[])){ if(have.has(x.id)) continue; const blob=await (await fetch(x.data)).blob(); await FB.db.media.put({id:x.id,fichaId:x.fichaId,tipo:x.tipo,nombre:x.nombre,creado:x.creado,blob}); }
  return {nuevas,act,igual};
};

/* ================= Indicador de conexión y service worker ================= */
FB.netIndicator = el=>{ if(!el) return; const u=()=>{el.textContent=navigator.onLine?'En línea':'Sin conexión';el.classList.toggle('off',!navigator.onLine);}; addEventListener('online',u); addEventListener('offline',u); u(); };
if('serviceWorker' in navigator && location.protocol!=='file:'){
  addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
}
})();
