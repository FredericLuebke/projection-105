'use strict';
// Navigation only. iframe isolates all financed-retirement inputs and globals.
(()=>{
 const shell=document.querySelector('.shell');
 const style=document.createElement('style');style.textContent='.retirement-tabs{display:flex;gap:10px;flex-wrap:wrap;padding:16px 24px;background:#101a2d;border-bottom:1px solid #293a50}.retirement-tabs button{padding:12px 18px;border:1px solid #3c617c;border-radius:10px;background:#14253a;color:#c8e5fa;cursor:pointer;font:600 14px "Segoe UI",sans-serif}.retirement-tabs button[aria-selected="true"]{background:#8bd5f7;color:#071523}.retirement-tabs button:focus-visible{outline:2px solid #6ee7b7;outline-offset:3px}#financedPanel iframe{width:100%;height:calc(100vh - 84px);border:0;display:block}';document.head.append(style);
 const nav=document.createElement('div');nav.className='retirement-tabs';nav.setAttribute('role','tablist');nav.setAttribute('aria-label','Calculs de retraite');
 nav.innerHTML='<button type="button" role="tab" id="tab105" aria-controls="projection105Panel" aria-selected="true">Projection du 105%</button><button type="button" role="tab" id="tabFinanced" aria-controls="financedPanel" aria-selected="false" tabindex="-1">Date de retraite financée · brouillon</button>';
 const original=document.createElement('div');original.id='projection105Panel';original.setAttribute('role','tabpanel');original.setAttribute('aria-labelledby','tab105');shell.before(nav,original);original.append(shell);
 const financed=document.createElement('div');financed.id='financedPanel';financed.hidden=true;financed.setAttribute('role','tabpanel');financed.setAttribute('aria-labelledby','tabFinanced');original.after(financed);
 const buttons=[...nav.querySelectorAll('button')];
 function select(index){buttons.forEach((b,i)=>{b.setAttribute('aria-selected',String(index===i));b.tabIndex=index===i?0:-1;});original.hidden=index!==0;financed.hidden=index!==1;if(index===1&&!financed.firstChild){const frame=document.createElement('iframe');frame.src='financed.html?v=13';frame.title='Brouillon indépendant de la date de retraite financée';financed.append(frame);}}
 buttons.forEach((b,i)=>b.onclick=()=>select(i));nav.onkeydown=e=>{let index=buttons.indexOf(document.activeElement);if(index<0)return;if(e.key==='ArrowRight'||e.key==='ArrowLeft')index=1-index;else if(e.key==='Home')index=0;else if(e.key==='End')index=1;else return;e.preventDefault();select(index);buttons[index].focus();};
})();
