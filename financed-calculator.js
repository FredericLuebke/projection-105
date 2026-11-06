'use strict';
// Independent module: no reads or writes to the 105% form or calculation globals.
function buildPurchaseTables(input){
 const {type,pastInterest,futureInterest,retirementAge,brackets,rates}=input;
 const finite=(v,min,max)=>Number.isFinite(v)&&v>=min&&v<=max;
 if(!['Base','1e'].includes(type)||!finite(pastInterest,0,100)||!finite(futureInterest,0,100)||!finite(retirementAge,58,70))throw Error('Vérifie le type de plan, les intérêts (0 à 100 %) et l’âge réglementaire (58 à 70 ans).');
 const sorted=brackets.map(b=>({...b})).sort((a,b)=>a.from-b.from);
 if(!sorted.length)throw Error('Ajoute au moins une tranche de bonification.');
 sorted.forEach((b,i)=>{
  if(!Number.isInteger(b.from)||!Number.isInteger(b.to)||b.from<16||b.to>70||b.from>b.to||!finite(b.rate,0,100))throw Error('Tranche invalide : âges entiers de 16 à 70 et bonification de 0 à 100 %.');
  if(i&&b.from!==sorted[i-1].to+1)throw Error('Les tranches doivent se suivre sans trou ni chevauchement.');
 });
 const start=sorted[0].from,max=Math.ceil(retirementAge);
 if(start>58)throw Error('Le début d’épargne doit être au plus tard à 58 ans pour construire les tabelles dès 58 ans.');
 if(start>=retirementAge||sorted.at(-1).to<max-1)throw Error('Les bonifications doivent couvrir toutes les années d’épargne avant la retraite.');
 const round3=v=>Math.round((v+Number.EPSILON)*1000)/1000;
 const bonus=age=>{const b=sorted.find(b=>age>=b.from&&age<=b.to);if(!b)throw Error(`Bonification manquante à ${age} ans.`);return b.rate/100;};
 const rateAt=age=>{
  const low=Math.floor(age),high=Math.ceil(age),fraction=age-low;
  if(!finite(rates[low],0.000001,100)||!finite(rates[high],0.000001,100))throw Error(`Taux de conversion strictement positif requis à ${low}${high!==low?' et '+high:''} ans.`);
  return (rates[low]*(1-fraction)+rates[high]*fraction)/100;
 };
 let raw=0,cap=0;
 const past=[];
 for(let age=start;age<=max;age++){
  if(age>start){const previous=bonus(age-1);raw=round3(raw*(1+pastInterest/100))+previous;cap+=previous!==0?.25:0;}
  past.push({age,raw,cap,coefficient:type==='1e'?Math.min(raw,cap):raw,bonus:age<retirementAge?bonus(age):null});
 }
 const pastAt=age=>{const low=Math.floor(age),fraction=age-low;const a=past.find(p=>p.age===low),b=fraction?past.find(p=>p.age===low+1):a;return a.coefficient*(1-fraction)+b.coefficient*fraction;};
 const targetPension=pastAt(retirementAge)*rateAt(retirementAge);
 const targets=[];for(let age=58;age<retirementAge;age++)targets.push(age);targets.push(retirementAge);
 const costs=targets.map(age=>({age,conversion:rateAt(age),pension:pastAt(age)*rateAt(age),capital:round3((targetPension-pastAt(age)*rateAt(age))/rateAt(age))}));
 // At target retirement age: rounded capital to compensate the pension difference.
 // Before that age: annual compound discount. Beyond target: not applicable.
 const future=past.filter(row=>row.age<=retirementAge).map(row=>({age:row.age,coefficients:costs.map(c=>row.age<=c.age?c.capital/Math.pow(1+futureInterest/100,c.age-row.age):null)}));
 return {input:{...input,brackets:sorted},start,past,targets,costs,future,targetPension,regulatoryCoefficient:pastAt(retirementAge)};
}