(async function(){
'use strict';
const {$, $$} = FB;
const form=$('#f');

/* Tabla de 5 intervalos */
$('#conteo').innerHTML=[0,1,2,3,4].map(i=>`<tr data-i="${i}">
  <td class="mono">${FB.pad(i*2)}–${FB.pad(i*2+2)}</td>
  <td class="num"><input type="number" inputmode="numeric" min="0" name="conteo.${i}.peatones" aria-label="Peatones ${i*2}–${i*2+2} min"></td>
  <td class="num"><input type="number" inputmode="numeric" min="0" name="conteo.${i}.vehiculos" aria-label="Vehículos ${i*2}–${i*2+2} min"></td>
  <td><input type="text" name="conteo.${i}.nota" placeholder="—"></td></tr>`).join('');

FB.wireCommon(form);
await FB.renderLugares($('[data-lugares]',form),form);

const page=await FB.ficha({tipo:'actividades',form,onAfterSave:rec=>FB.wireNext(rec)});
FB.form.wireRepeats(form,page.touch);
FB.prefill(form);
const cod=$('[name=codigo]',form);
const link=await FB.enlazarSonora(form,cod);
if(!page.rec&&cod.value) link.fill();
const lc=$('[data-lugares]',form); lc._upd&&lc._upd();
cod.addEventListener('blur',()=>{const v=FB.normCodigo(cod.value); if(v!==cod.value){cod.value=v;page.touch();}});

/* Totales y vista del intervalo activo */
const t=FB.timer($('[data-timer]'),form,page.touch);
const intChips=$$('[name=intActivo]',form);
function activo(){ const ti=t.interval(); return ti>=0?ti:+(intChips.find(r=>r.checked)||{value:0}).value; }
function totales(){
  let p=0,v=0; for(let i=0;i<5;i++){p+=parseInt(form.elements[`conteo.${i}.peatones`].value)||0;v+=parseInt(form.elements[`conteo.${i}.vehiculos`].value)||0;}
  $('#tot-p').textContent=p; $('#tot-v').textContent=v;
  const i=activo();
  $('[data-show=peatones]').textContent=parseInt(form.elements[`conteo.${i}.peatones`].value)||0;
  $('[data-show=vehiculos]').textContent=parseInt(form.elements[`conteo.${i}.vehiculos`].value)||0;
  $$('#conteo tr').forEach(tr=>tr.classList.toggle('cur',+tr.dataset.i===i));
}
let lastInt=-2;
t.onTick=()=>{
  const ti=t.interval();
  if(ti>=0){ intChips.forEach(r=>r.checked=(+r.value===ti)); $('#int-lbl').textContent='Intervalo en curso (automático)'; }
  else $('#int-lbl').textContent='Intervalo donde se suma';
  if(ti!==lastInt){lastInt=ti;totales();}
};
intChips.forEach(r=>r.addEventListener('change',totales));
form.addEventListener('input',totales);

/* Botones grandes de conteo */
function sumar(campo,d){
  const i=activo(), inp=form.elements[`conteo.${i}.${campo}`];
  inp.value=Math.max(0,(parseInt(inp.value)||0)+d);
  if(d>0){ try{navigator.vibrate&&navigator.vibrate(12);}catch(_){} }
  inp.dispatchEvent(new Event('input',{bubbles:true}));
}
$$('[data-count]').forEach(b=>b.addEventListener('click',()=>sumar(b.dataset.count,1)));
$$('[data-uncount]').forEach(b=>b.addEventListener('click',()=>sumar(b.dataset.uncount,-1)));

/* "Minuto actual" en situaciones */
form.addEventListener('click',e=>{
  const b=e.target.closest('[data-minuto]'); if(!b) return;
  const s=+form.elements.timerStart.value; const inp=$('input[type=number]',b.parentElement);
  if(!s){FB.toast('Inicia el cronómetro para usar el minuto actual');return;}
  const end=+form.elements.timerEnd.value||Date.now();
  inp.value=Math.floor((end-s)/60000); inp.dispatchEvent(new Event('input',{bubbles:true}));
});

t.refresh(); totales();
FB.wireNext(page.rec);
})();
