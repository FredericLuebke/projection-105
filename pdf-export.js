'use strict';

// PDF generated entirely on the device; no external service or persistent data store.
const exportStyles=document.createElement('style');
exportStyles.textContent=`.pdf-button{margin-top:12px;background:#bbf7d0;border-color:#86efac;color:#14532d}.pdf-dialog{color:#e8eef8;background:#111d2e;border:1px solid #3c617c;border-radius:16px;padding:24px;width:min(440px,90vw)}.pdf-dialog::backdrop{background:#0009}.pdf-dialog h2{margin-top:0}.pdf-dialog .fields{grid-template-columns:1fr}.pdf-actions{display:flex;justify-content:flex-end;gap:12px;margin-top:20px}.pdf-actions button{padding:10px 14px;border:1px solid #35617d;border-radius:8px;cursor:pointer}.pdf-dialog .pdf-error{color:#fca5a5;font-size:13px}.pdf-note{font-size:12px;color:#91a0b6;line-height:1.6}`;
document.head.append(exportStyles);
const pdfButton=document.createElement('button');
pdfButton.type='button';pdfButton.className='calc pdf-button';pdfButton.id='savePdf';
pdfButton.textContent='Enregistrer en PDF';
document.getElementById('calculate').after(pdfButton);
const pdfDialog=document.createElement('dialog');
pdfDialog.className='pdf-dialog';pdfDialog.setAttribute('aria-labelledby','pdfTitle');
pdfDialog.innerHTML=`<form id="pdfForm"><h2 id="pdfTitle">Enregistrer le calcul en PDF</h2><p class="pdf-note">Les données actuelles seront recalculées et jointes au document avec les projections mensuelles en annexe.</p><div class="fields"><label class="field">Numéro d’œuvre<input name="oeuvre" type="text" required maxlength="60" autocomplete="off"></label><label class="field">Numéro de personne<input name="personne" type="text" required maxlength="60" autocomplete="off"></label></div><p class="pdf-error" role="alert"></p><div class="pdf-actions"><button type="button" id="pdfCancel">Annuler</button><button type="submit" id="pdfSubmit">Télécharger le PDF</button></div></form>`;
document.body.append(pdfDialog);
pdfButton.addEventListener('click',()=>{pdfDialog.querySelector('.pdf-error').textContent='';pdfDialog.showModal();});
document.getElementById('pdfCancel').addEventListener('click',()=>pdfDialog.close());
pdfDialog.addEventListener('close',()=>pdfButton.focus());

// Standard PDF font uses WinAnsi (Western European accents). Reject unsupported identifiers
// rather than silently corrupting their reference in the saved document.
function pdfReference(value){
 const text=value.trim();
 if(!text||text.length>60||/[\x00-\x1f\x7f-\x9f]/.test(text))throw Error('Saisis les deux références (60 caractères maximum).');
 if(/[^\x20-\x7e\xa0-\xff]/.test(text))throw Error('Utilise des lettres latines, chiffres ou signes usuels pour les références.');
 return text;
}
function pdfText(text){return String(text).replace(/[’‘]/g,"'").replace(/œ/g,'oe').replace(/Œ/g,'OE').replace(/[–—]/g,'-').replace(/\u202f/g,' ').replace(/\u2264/g,'<=');}
function safePdfName(text){return text.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,60)||'reference';}
function projectionPdf(output,refs,created=new Date()){
 if(!globalThis.jspdf?.jsPDF)throw Error('La bibliothèque PDF est indisponible. Recharge la page et réessaie.');
 const doc=new globalThis.jspdf.jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true});
 if(typeof doc.autoTable!=='function')throw Error('Le module de tableaux PDF est indisponible. Recharge la page.');
 const margin=14,green=[20,83,45];let y=27;
 const money=value=>fmt(value);
 const rate=value=>value.toFixed(4);
 const annual=(balance,date)=>ageInMonths(output.birth,date)<696?'-':money(balance*conversionAt(output.birth,date)/100);
 const heading=(title,landscape=false)=>{
  doc.addPage('a4',landscape?'landscape':'portrait');y=27;
  doc.setFont('helvetica','bold');doc.setFontSize(15);doc.setTextColor(...green);doc.text(pdfText(title),margin,y);y+=9;
 };
 const text=(content,size=10)=>{
  doc.setFont('helvetica','normal');doc.setFontSize(size);doc.setTextColor(25,40,50);
  const lines=doc.splitTextToSize(pdfText(content),doc.internal.pageSize.getWidth()-margin*2);
  for(const line of lines){if(y>doc.internal.pageSize.getHeight()-24){doc.addPage();y=27;}doc.text(line,margin,y);y+=size*.45+1;}
  y+=2;
 };
 const table=(head,body,options={})=>{
  doc.autoTable({startY:y,head:[head.map(pdfText)],body:body.map(row=>row.map(pdfText)),margin:{top:27,bottom:22,left:margin,right:margin},
   styles:{font:'helvetica',fontSize:8,cellPadding:2,overflow:'linebreak',textColor:[25,40,50]},headStyles:{fillColor:green,textColor:255},
   alternateRowStyles:{fillColor:[242,248,245]},rowPageBreak:'avoid',...options});
  y=doc.lastAutoTable.finalY+8;
 };
 doc.setProperties({title:'Projection 105% - calcul de prévoyance',subject:`Oeuvre ${refs.oeuvre} - Personne ${refs.personne}`,creator:'Projection 105% - export local v1'});
 doc.setFont('helvetica','bold');doc.setFontSize(22);doc.setTextColor(...green);doc.text('Projection 105%',margin,y);y+=12;
 text(`N° d'oeuvre : ${refs.oeuvre}\nN° de personne : ${refs.personne}`);
 text(`Enregistré le ${dateFmt(created)} à ${created.toLocaleTimeString('fr-CH')} (heure locale).\nVersion du calcul : projection mensuelle 105% / export v1.`);
 table(['Résultats cumulés - tous plans','Valeur'],[
  ['Retraite réglementaire',dateFmt(output.end)],
  ['Rente annuelle sans rachat à la retraite réglementaire (CHF)',money(output.reference)],
  ['Montant limite annuel : 105% (CHF)',money(output.limit)]
 ]);
 if(y>230){doc.addPage();y=27;}
 doc.setFillColor(220,252,231);doc.roundedRect(margin,y,182,32,3,3,'F');
 doc.setFont('helvetica','bold');doc.setTextColor(...green);doc.setFontSize(11);
 doc.text('Dernière fin de mois sans dépassement',margin+5,y+9);
 doc.setFontSize(output.lastSafe?22:10);
 doc.text(output.lastSafe?dateFmt(output.lastSafe.date):'Aucune date admissible dans la période.',margin+5,y+23);y+=40;
 if(output.lastSafe)text(`Rente annuelle avec rachat à cette date : CHF ${money(output.lastSafe.pension)}`);
 text(output.firstExceeded?(output.lastSafe?'Dernière échéance mensuelle respectant la limite de 105%.':'La limite est déjà dépassée au premier mois évalué.'):'Aucun dépassement jusqu’à la retraite réglementaire.');
 text(`Comparaison à partir du ${dateFmt(output.searchStart)}. Aucune rente anticipée extrapolée avant 58 ans. Une égalité au seuil est autorisée. Les comparaisons utilisent les montants non arrondis.`,9);
 text('Projection indicative, non contractuelle. Les taux préremplis sont fictifs : vérifier les barèmes et hypothèses avec les documents de la caisse. Ce document ne constitue pas un conseil financier.',9);
 heading('Données saisies - paramètres généraux');
 table(['Paramètre','Valeur'],[
  ['Date de naissance',dateFmt(output.birth)],['Date de calcul',dateFmt(output.calcDate)],
  ['Age de retraite réglementaire',money(output.retAge)],['Nombre de plans',String(output.results.length)]
 ]);
 const maximumAge=Math.ceil(output.retAge);
 table(['Age','Taux de conversion (%)'],Array.from({length:maximumAge-57},(_,i)=>[String(i+58),money(rates.get(i+58))]));
 text('Taux interpolés linéairement au mois. Age LPP = année civile - année de naissance. Intérêts mensuels sur la base de l’avoir au 1er janvier ; bonification mensuelle. Dernier mois crédité entier.',9);
 for(const result of output.results){
  const p=result.parameters;
  heading(`Données saisies - ${p.name}`);
  table(['Paramètre','Valeur'],[
   ['Avoir initial sans rachat (CHF)',money(p.balance)],['Avoir initial avec rachat (CHF)',money(p.withBalance)],
   ['Salaire retraite annuel (CHF)',money(p.salary)],['Taux d’intérêt annuel (%)',money(p.interest)],
   ['Avoir sans rachat à la retraite (CHF)',money(result.balance)],['Rente annuelle sans rachat à la retraite (CHF)',money(result.pension)],
   ['Avoir avec rachat à la retraite (CHF)',money(result.withPurchase.at(-1).balance)]
  ]);
  table(['Age LPP dès','Age LPP jusqu’à','Bonification annuelle (%)'],p.brackets.map(b=>[b.from,b.to,money(b.rate)]));
 }
 heading('Annexe - projection mensuelle cumulée',true);
 const cumulative=output.results[0].without.map((month,index)=>{
  const age=ageInMonths(output.birth,month.date),applicable=age>=696;
  const without=output.results.reduce((sum,p)=>sum+p.without[index].balance,0);
  const withPurchase=output.results.reduce((sum,p)=>sum+p.withPurchase[index].balance,0);
  return [dateFmt(month.date),`${Math.floor(age/12)}a ${age%12}m`,applicable?rate(conversionAt(output.birth,month.date)):'-',money(without),money(withPurchase),annual(without,month.date),annual(withPurchase,month.date),money(output.limit)];
 });
 const highlighted=(data)=>{if(data.section==='body'&&output.lastSafe&&data.row.raw[0]===dateFmt(output.lastSafe.date)){data.cell.styles.fillColor=[220,252,231];data.cell.styles.fontStyle='bold';}};
 table(['Fin de mois','Age','Conversion\n(%)','Avoir\nsans rachat\n(CHF)','Avoir\navec rachat\n(CHF)','Rente annuelle\nsans rachat\n(CHF)','Rente annuelle\navec rachat\n(CHF)','Limite 105%\n(CHF)'],cumulative,{didParseCell:highlighted,columnStyles:{0:{cellWidth:26},1:{cellWidth:18},2:{cellWidth:25},3:{cellWidth:40},4:{cellWidth:40},5:{cellWidth:40},6:{cellWidth:40},7:{cellWidth:40}}});
 for(const result of output.results){
  heading(`Annexe - détail mensuel ${result.name}`,true);
   table(['Fin de mois','Age LPP','Bonification\ndu mois\n(CHF)','Intérêts\nsans rachat\n(CHF)','Intérêts\navec rachat\n(CHF)','Avoir\nsans rachat\n(CHF)','Avoir\navec rachat\n(CHF)','Rente annuelle\nsans rachat\n(CHF)','Rente annuelle\navec rachat\n(CHF)'],result.without.map((m,i)=>{
   const withMonth=result.withPurchase[i];return [dateFmt(m.date),m.lppAge,money(m.bonus),money(m.interest),money(withMonth.interest),money(m.balance),money(withMonth.balance),annual(m.balance,m.date),annual(withMonth.balance,m.date)];
    }),{didParseCell:highlighted,columnStyles:{0:{cellWidth:26},1:{cellWidth:15},2:{cellWidth:30},3:{cellWidth:30},4:{cellWidth:30},5:{cellWidth:34},6:{cellWidth:34},7:{cellWidth:35},8:{cellWidth:35}}});
 }
 const pages=doc.getNumberOfPages();
 for(let page=1;page<=pages;page++){
  doc.setPage(page);doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(70,90,80);
  const width=doc.internal.pageSize.getWidth(),height=doc.internal.pageSize.getHeight();
  doc.text(pdfText(`Oeuvre : ${refs.oeuvre} | Personne : ${refs.personne}`),margin,12,{maxWidth:width-2*margin});
  doc.text(`Projection indicative - ${dateFmt(created)} | Page ${page}/${pages}`,margin,height-10);
 }
 return doc;
}
document.getElementById('pdfForm').addEventListener('submit',async event=>{
 event.preventDefault();const submit=document.getElementById('pdfSubmit');if(submit.disabled)return;
 const error=pdfDialog.querySelector('.pdf-error');error.textContent='';submit.disabled=true;pdfButton.disabled=true;
 try{
  const refs={oeuvre:pdfReference(pdfDialog.querySelector('[name=oeuvre]').value),personne:pdfReference(pdfDialog.querySelector('[name=personne]').value)};
  // Synchronous snapshot and refresh: the PDF and screen use the current form, never an old result.
  const output=calc();document.getElementById('calculate').click();
  const created=new Date(),doc=projectionPdf(output,refs,created);
  const stamp=`${created.getFullYear()}${String(created.getMonth()+1).padStart(2,'0')}${String(created.getDate()).padStart(2,'0')}_${String(created.getHours()).padStart(2,'0')}${String(created.getMinutes()).padStart(2,'0')}${String(created.getSeconds()).padStart(2,'0')}`;
  await doc.save(`Projection105_oeuvre-${safePdfName(refs.oeuvre)}_personne-${safePdfName(refs.personne)}_${stamp}.pdf`,{returnPromise:true});
  pdfDialog.close();
 }catch(e){error.textContent=e.message||'Impossible de générer le PDF.';}
 finally{submit.disabled=false;pdfButton.disabled=false;}
});