'use strict';

// PDF generated locally in the funded-retirement iframe.
const financedPdfStyles=document.createElement('style');
financedPdfStyles.textContent='.pdf-dialog{width:min(440px,90vw);padding:24px;border:1px solid #3c617c;border-radius:14px;background:#111d2e;color:#e8eef8}.pdf-dialog::backdrop{background:#0009}.pdf-dialog h2{margin-top:0}.pdf-dialog .fields{grid-template-columns:1fr}.pdf-actions{display:flex;justify-content:flex-end;gap:12px;margin-top:20px}.pdf-actions button{padding:10px 14px;border:1px solid #35617d;border-radius:8px;cursor:pointer}.pdf-note{font-size:12px;color:#91a0b6;line-height:1.6}.pdf-error{color:#fca5a5;font-size:13px}';
document.head.append(financedPdfStyles);

const financedPdfDialog=document.createElement('dialog');
financedPdfDialog.className='pdf-dialog';
financedPdfDialog.setAttribute('aria-labelledby','financedPdfTitle');
financedPdfDialog.innerHTML='<form id="financedPdfForm"><h2 id="financedPdfTitle">Enregistrer le calcul en PDF</h2><p class="pdf-note">Le document inclura le résultat calculé, les hypothèses saisies et les tableaux détaillés. Le PDF est généré localement.</p><div class="fields"><label>Numéro d’œuvre<input name="oeuvre" type="text" required maxlength="60" autocomplete="off"></label><label>Numéro de personne<input name="personne" type="text" required maxlength="60" autocomplete="off"></label></div><p class="pdf-error" role="alert"></p><div class="pdf-actions"><button type="button" id="financedPdfCancel">Annuler</button><button type="submit" id="financedPdfSubmit">Télécharger le PDF</button></div></form>';
document.body.append(financedPdfDialog);

let financedPdfTrigger=null;
const financedPdfButton=document.getElementById('saveFinancedPdf');
financedPdfButton.addEventListener('click',()=>{
 financedPdfTrigger=financedPdfButton;
 financedPdfDialog.querySelector('.pdf-error').textContent='';
 financedPdfDialog.showModal();
});
document.getElementById('financedPdfCancel').addEventListener('click',()=>financedPdfDialog.close());
financedPdfDialog.addEventListener('close',()=>{if(financedPdfTrigger?.isConnected)financedPdfTrigger.focus();});

function financedPdfReference(value){
 const text=value.trim();
 if(!text||text.length>60||/[\x00-\x1f\x7f-\x9f]/.test(text))throw Error('Saisis les deux références (60 caractères maximum).');
 if(/[^\x20-\x7e\xa0-\xff]/.test(text))throw Error('Utilise des lettres latines, chiffres ou signes usuels pour les références.');
 return text;
}
function financedPdfText(value){return String(value).replace(/[’‘]/g,"'").replace(/œ/g,'oe').replace(/Œ/g,'OE').replace(/[–—]/g,'-').replace(/\u202f/g,' ').replace(/\u2264/g,'<=');}
function financedPdfElementText(element){
 let text='';
 const append=node=>{
  if(node.nodeType===Node.TEXT_NODE){text+=node.nodeValue;return;}
  if(node.nodeName==='BR'){text+='\n';return;}
  for(const child of node.childNodes)append(child);
 };
 append(element);
 return text.replace(/[ \t]*\n[ \t]*/g,'\n').trim();
}
function financedPdfSafeName(value){return value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,60)||'reference';}
function financedPdfDate(date){return `${String(date.getDate()).padStart(2,'0')}.${String(date.getMonth()+1).padStart(2,'0')}.${date.getFullYear()}`;}
function financedPdfValue(id){const element=document.getElementById(id);return element?.value??'';}
function financedPdfMethod(){return financedPdfValue('scenario')==='external'?'Tabelle de rachat (externe)':financedPdfValue('scenario')==='projection'?'Projection de l’avoir':'Tabelle de rachat FCT';}
function financedPdfInputs(){
 const projection=financedPdfValue('scenario')==='projection',external=financedPdfValue('scenario')==='external';
 const rows=[
  ['Méthode de calcul',financedPdfMethod()],
  ...external?[]:[['Type de plan',financedPdfValue('planType')]],
  ['Sexe',financedPdfValue('sex')],
  ...external?[]:[['Année du plan 1e',financedPdfValue('year')]],
  ['Date de naissance',financedPdfValue('fundBirth')],
  ['Date du dernier rachat',financedPdfValue('fundDate')],
  ['Âge de retraite réglementaire',financedPdfValue('regAge')],
  ['Âge minimal de retraite anticipée',financedPdfValue('minimumAge')],
  ['Salaire assuré (CHF)',financedPdfValue('fundSalary')],
  ...external?[]:[['Avoir sans rachats futurs (CHF)',projection?financedPdfValue('initialBalance'):'Non utilisé en mode tabelle']],
  ['Rachat effectué (CHF)',financedPdfValue('lastPurchase')],
  ['Rachats antérieurs (CHF)',financedPdfValue('previousPurchases')]
 ];
 if(external){rows.push(['Source des coefficients','Tabelle Excel externe, coefficients en % du salaire, sans nouvel escompte.']);return rows;}
 if(projection){
  rows.push(['Taux de projection jusqu’à la fin de l’année (%)',financedPdfValue('projectionCurrentRate')]);
  rows.push(['Taux de projection dès l’année suivante (%)',financedPdfValue('projectionNextRate')]);
 }else{
  rows.push(['Taux d’intérêt des rachats du passé (%)',financedPdfValue('pastRate')]);
  rows.push(['Taux d’intérêt / d’escompte des rachats du futur (%)',financedPdfValue('futureRate')]);
 }
 const brackets=[...document.querySelectorAll('#brackets tr')].map(row=>[
  row.querySelector('.from').value,
  row.querySelector('.to').value,
  row.querySelector('.bonus').value
 ]);
 if(brackets.length)rows.push(['Bonifications par tranche d’âge',brackets.map(([from,to,rate])=>`${from}-${to} ans : ${rate} %`).join('\n')]);
 const conversionRows=[...document.querySelectorAll('#rates tr')].map(row=>[
  row.cells[0].textContent.trim(),
  row.querySelector('input').value
 ]);
 if(conversionRows.length)rows.push(['Taux de conversion',conversionRows.map(([age,rate])=>`${age} ans : ${rate} %`).join('\n')]);
 return rows;
}
function financedPdfDocument(refs,created){
 if(!globalThis.jspdf?.jsPDF)throw Error('La bibliothèque PDF est indisponible. Recharge la page et réessaie.');
 const doc=new globalThis.jspdf.jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true});
 if(typeof doc.autoTable!=='function')throw Error('Le module de tableaux PDF est indisponible. Recharge la page.');
 const margin=14,green=[20,83,45];let y=27;
 const addText=(value,size=9)=>{
  if(!value)return;
  doc.setFont('helvetica','normal');doc.setFontSize(size);doc.setTextColor(25,40,50);
  const lines=doc.splitTextToSize(financedPdfText(value),doc.internal.pageSize.getWidth()-margin*2);
  for(const line of lines){if(y>doc.internal.pageSize.getHeight()-24){doc.addPage('a4','portrait');y=27;}doc.text(line,margin,y);y+=size*.45+1;}
  y+=2;
 };
 const addHeading=(title,landscape=false)=>{
  doc.addPage('a4',landscape?'landscape':'portrait');y=25;
  doc.setFont('helvetica','bold');doc.setFontSize(15);doc.setTextColor(...green);
  doc.text(financedPdfText(title),margin,y);y+=9;
 };
 const addWarning=(title,value)=>{
  doc.setFont('helvetica','bold');doc.setFontSize(15);doc.setTextColor(...green);
  doc.text(financedPdfText(title),margin,y);y+=9;
  doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor(190,35,35);
  const lines=doc.splitTextToSize(financedPdfText(value),doc.internal.pageSize.getWidth()-margin*2);
  for(const line of lines){doc.text(line,margin,y);y+=9*.45+1;}
  y+=2;
 };
 const addTable=(headers,rows,landscape=headers.length>5)=>{
  doc.autoTable({startY:y,head:[headers.map(financedPdfText)],body:rows.map(row=>row.map(value=>financedPdfText(value??''))),margin:{top:22,bottom:18,left:margin,right:margin},styles:{font:'helvetica',fontSize:8,cellPadding:2,overflow:'linebreak',textColor:[25,40,50]},headStyles:{fillColor:green,textColor:255},alternateRowStyles:{fillColor:[242,248,245]},rowPageBreak:'avoid',showHead:'everyPage'});
  y=doc.lastAutoTable.finalY+8;
 };
 const addFundingHighlight=panel=>{
  const summary=panel?.querySelector(':scope > .summary');
  const label=summary?.querySelector('small')?.textContent.trim()||'DATE DE RETRAITE FINANCÉE';
  const date=summary?.querySelector('strong')?.textContent.trim()||'Aucune date admissible';
  const age=summary?.querySelector('b')?.textContent.trim()||'';
  const labelLines=doc.splitTextToSize(financedPdfText(label),168),boxHeight=22+labelLines.length*4+(age?8:0);
  if(y+boxHeight>doc.internal.pageSize.getHeight()-20){doc.addPage('a4','portrait');y=25;}
  doc.setFillColor(220,252,231);doc.setDrawColor(134,239,172);doc.roundedRect(margin,y,182,boxHeight,3,3,'FD');
  doc.setFont('helvetica','bold');doc.setTextColor(...green);doc.setFontSize(8);doc.text(labelLines,margin+5,y+7);
    const dateY=y+13+labelLines.length*4;doc.setFontSize(22);doc.text(financedPdfText(date),margin+5,dateY);
    if(age){doc.setFontSize(9);doc.text(financedPdfText(`Âge : ${age}`),margin+5,dateY+8);}
  y+=boxHeight+7;
 };
 const resultPanels=[...document.querySelectorAll('#fundingResult > .panel')],fundingPanel=resultPanels.at(-1);
 doc.setProperties({title:'Date de retraite financée - calcul de prévoyance',subject:`Oeuvre ${refs.oeuvre} - Personne ${refs.personne}`,creator:'Projection 105% - export retraite financée v1'});
 doc.setFont('helvetica','bold');doc.setFontSize(21);doc.setTextColor(...green);doc.text('Date de retraite financée',margin,y);y+=11;
 addText(`N° d’œuvre : ${refs.oeuvre}\nN° de personne : ${refs.personne}`);
 addText(`Enregistré le ${financedPdfDate(created)} à ${created.toLocaleTimeString('fr-CH')} (heure locale).\nMéthode : ${financedPdfMethod()}.`);
 addFundingHighlight(fundingPanel);
 const retainedMetrics=[...(fundingPanel?.querySelectorAll(':scope > .result-metric')||[])].map(row=>[
  row.querySelector('span')?.textContent.trim()||'',
  row.querySelector('strong')?.textContent.trim()||''
 ]);
 if(retainedMetrics.length)addTable(['Résultat retenu','Valeur'],retainedMetrics,false);
 const fundingNote=fundingPanel?.querySelector(':scope > .note');
 if(fundingNote)addText(fundingNote.textContent.trim(),8);
 y+=4;
 addWarning('Avertissement','Projection indicative, non contractuelle. Les résultats dépendent des taux, bonifications et hypothèses saisis; vérifier les valeurs avec les documents de la caisse. Ce document ne constitue pas un décompte officiel ni un conseil financier.');
 addHeading('Hypothèses saisies');
 addTable(['Données saisies','Valeur'],financedPdfInputs());
 for(const panel of resultPanels){
  const title=panel.querySelector('h2')?.textContent.trim();
  if(title&&panel!==fundingPanel)addHeading(title);
  if(panel!==fundingPanel){
   const summary=panel.querySelector(':scope > .summary');
   if(summary)addText(financedPdfElementText(summary));
   for(const note of panel.querySelectorAll(':scope > .note'))addText(financedPdfElementText(note),8);
  }else{
    for(const note of panel.querySelectorAll(':scope > .note'))if(note!==fundingNote)addText(financedPdfElementText(note),8);
  }
 }
 const outputTables=[...document.querySelectorAll('#fundingResult table, #tables table')];
 for(const [index,table] of outputTables.entries()){
  const clean=value=>String(value).replace(/\s+/g,' ').trim();
  const headers=[...table.querySelectorAll('thead th')].map(cell=>clean(cell.textContent));
  const rows=[...table.querySelectorAll('tbody tr')].map(row=>[...row.cells].map(cell=>clean(cell.textContent)));
  if(!headers.length||!rows.length)continue;
  const title=table.closest('details')?.querySelector('summary')?.textContent.trim()||table.closest('.panel')?.querySelector('h2')?.textContent.trim()||`Tableau ${index+1}`;
  addHeading(title,headers.length>5);
  addTable(headers,rows,headers.length>5);
 }
 const pages=doc.getNumberOfPages();
 for(let page=1;page<=pages;page++){
  doc.setPage(page);doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(70,90,80);
  const width=doc.internal.pageSize.getWidth(),height=doc.internal.pageSize.getHeight();
  doc.text(financedPdfText(`Oeuvre : ${refs.oeuvre} | Personne : ${refs.personne}`),margin,12,{maxWidth:width-2*margin});
  doc.text(`Retraite financée - ${financedPdfDate(created)} | Page ${page}/${pages}`,margin,height-10);
 }
 return doc;
}
document.getElementById('financedPdfForm').addEventListener('submit',async event=>{
 event.preventDefault();
 const submit=document.getElementById('financedPdfSubmit'),error=financedPdfDialog.querySelector('.pdf-error');
 if(submit.disabled)return;
 error.textContent='';submit.disabled=true;financedPdfButton.disabled=true;
 try{
  if(!$('fundingResult').hasChildNodes()||!$('stale').hidden)throw Error('Relance le calcul avant de créer le PDF.');
  const refs={oeuvre:financedPdfReference(financedPdfDialog.querySelector('[name=oeuvre]').value),personne:financedPdfReference(financedPdfDialog.querySelector('[name=personne]').value)};
  const doc=financedPdfDocument(refs,new Date());
  await doc.save(`RetraiteFinancee_oeuvre-${financedPdfSafeName(refs.oeuvre)}_personne-${financedPdfSafeName(refs.personne)}.pdf`,{returnPromise:true});
  financedPdfDialog.close();
 }catch(exception){error.textContent=exception.message||'Impossible de générer le PDF.';}
 finally{submit.disabled=false;financedPdfButton.disabled=false;}
});
