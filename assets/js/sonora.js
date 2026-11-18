(async function(){
'use strict';
const {$, $$} = FB;
const form=$('#f');
FB.renderScales(form);
FB.wireCommon(form);
await FB.renderLugares($('[data-lugares]',form),form);

const page=await FB.ficha({
  tipo:'sonora', form,
  onAfterSave: rec=>{ FB.wireNext(rec); }
});
FB.form.wireRepeats(form,page.touch);
FB.prefill(form);
const lc=$('[data-lugares]',form); lc._upd&&lc._upd();

/* Código sugerido */
const cod=$('[name=codigo]',form), obs=$('[name=observador]',form);
async function sugerir(force){
  if(!force&&cod.value) return;
  cod.value=await FB.sugerirCodigo(obs.value);
  if(force||page.rec) page.touch();
}
$('#sugerir').addEventListener('click',()=>sugerir(true));
if(!page.rec&&obs.value&&!cod.value) sugerir();
obs.addEventListener('change',()=>{ if(!cod.value) sugerir(); });
cod.addEventListener('blur',()=>{ const v=FB.normCodigo(cod.value); if(v!==cod.value){cod.value=v;page.touch();} });

/* Lista de fuentes para "predominante" */
const dl=$('#dl-fuentes');
const updDl=()=>{ dl.innerHTML=$$('[data-k=sonido]',form).map(i=>i.value.trim()).filter(Boolean).map(v=>`<option value="${FB.esc(v)}">`).join(''); };
form.addEventListener('input',e=>{ if(e.target.dataset.k==='sonido') updDl(); });
updDl();

/* Cronómetro */
const t=FB.timer($('[data-timer]'),form,page.touch);
t.refresh();

/* Fotos */
FB.fotos($('[data-fotos]',form),page.ensureId).render();

FB.wireNext(page.rec);
})();
