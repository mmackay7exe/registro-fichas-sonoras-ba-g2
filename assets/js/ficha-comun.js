/* Comportamientos comunes de las páginas de ficha */
(function(){
'use strict';
const {$, $$} = FB;

/* Escalas 1–5 */
FB.renderScales = form=>$$('[data-scale]',form).forEach(c=>{
  const n=c.dataset.scale;
  c.innerHTML=[1,2,3,4,5].map(i=>`<label class="chip"><input type="radio" name="${n}" value="${i}"><span>${i}</span></label>`).join('');
});

/* Contadores +1 / −1 y botón "Ahora" (delegados) */
FB.wireCommon = form=>{
  form.addEventListener('click',e=>{
    const step=e.target.closest('[data-step]');
    if(step){
      const inp=$('input[type=number]',step.parentElement);
      inp.value=Math.max(0,(parseInt(inp.value)||0)+(+step.dataset.step));
      inp.classList.remove('flash'); void inp.offsetWidth; inp.classList.add('flash');
      try{ if(+step.dataset.step>0) navigator.vibrate&&navigator.vibrate(15); }catch(_){}
      inp.dispatchEvent(new Event('input',{bubbles:true}));
      return;
    }
    const now=e.target.closest('[data-now]');
    if(now){
      const t=$('input[type=time]',now.parentElement); t.value=FB.hora();
      t.dispatchEvent(new Event('input',{bubbles:true}));
    }
  });
};

/* Enlaces "continuar" con código y lugar de esta ficha */
FB.updateNext = rec=>{
  if(!rec) return;
  const q=`?codigo=${encodeURIComponent(rec.codigo||'')}&lugar=${encodeURIComponent(rec.lugar||'')}`;
  $$('[data-next]').forEach(a=>{ a.href=a.dataset.next+q; });
};
FB.wireNext = async rec=>{
  if(FB.page&&FB.page.sim){
    const sims=rec?(await FB.simulados()).filter(r=>r.codigo===rec.codigo):[];
    $$('[data-next]').forEach(a=>{ const ex=sims.find(r=>r.tipo===a.dataset.tipo);
      if(ex){ a.href=`${FB.TIPOS[ex.tipo].url}?sim=${ex.id}`; a.textContent=`Ver · ${FB.TIPOS[ex.tipo].nombre} →`; } else a.classList.add('hidden'); });
    return;
  }
  // si ya existe la ficha enlazada, abrirla en vez de crear otra
  const recs=rec&&rec.codigo?(await FB.db.all()).filter(r=>r.codigo===rec.codigo):[];
  $$('[data-next]').forEach(a=>{
    const tipo=a.dataset.tipo; if(!FB.TIPOS[tipo]){a.classList.add('hidden');return;} const ex=recs.find(r=>r.tipo===tipo);
    if(ex){ a.href=`${FB.TIPOS[tipo].url}?id=${ex.id}`; a.textContent=`Abrir · ${FB.TIPOS[tipo].nombre} →`; }
    else if(rec){ a.href=`${FB.TIPOS[tipo].url}?codigo=${encodeURIComponent(rec.codigo||'')}&lugar=${encodeURIComponent(rec.lugar||'')}`; }
  });
};
})();
