'use strict';
const ONE_E_CONVERSION_RATES={
 2026:{Homme:[2.96,3.05,3.13,3.23,3.33,3.43,3.54,3.66],Femme:[3.12,3.22,3.32,3.43,3.54,3.67,3.80,3.94]},
 2027:{Homme:[3.01,3.10,3.19,3.29,3.40,3.51,3.63,3.76,3.90,4.04,4.20,4.37,4.55],Femme:[3.13,3.23,3.33,3.44,3.56,3.69,3.82,3.96,4.12,4.28,4.46,4.65,4.86]}
};
// Independent module: no reads or writes to the 105% form or calculation globals.
function buildPurchaseTables(input){
 const {type,pastInterest,futureInterest,retirementAge,brackets,rates}=input;
 const finite=(v,min,max)=>Number.isFinite(v)&&v>=min&&v<=max;
 if(!['Base','1e'].includes(type)||!finite(pastInterest,0,100)||!finite(futureInterest,0,100)||!finite(retirementAge,58,70))throw Error('Vérifie le type de plan, les intérêts (0 à 100 %) et l’âge réglementaire (58 à 70 ans).');
 if(type==='1e'&&(pastInterest!==0||futureInterest!==0))throw Error('Selon le classeur, les taux d’intérêt du plan 1e doivent être de 0 %.');
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
 const bonus=age=>{if(age<start||age>retirementAge)return 0;const b=sorted.find(b=>age>=b.from&&age<=b.to);if(!b)throw Error(`Bonification manquante à ${age} ans.`);return b.rate/100;};
 const rateAt=age=>{
  const low=Math.floor(age),high=Math.ceil(age),fraction=age-low;
  if(!finite(rates[low],0.000001,100)||!finite(rates[high],0.000001,100))throw Error(`Taux de conversion strictement positif requis à ${low}${high!==low?' et '+high:''} ans.`);
  return (rates[low]*(1-fraction)+rates[high]*fraction)/100;
 };
 let raw=0,cap=0;
 const past=[];
 for(let age=16;age<=70;age++){
    if(age>16&&age<=max){
     const previous=bonus(age-1),fractionalEndpoint=age===max&&!Number.isInteger(retirementAge);
     // Excel freezes the late-career accumulation when the current savings rate is zero.
     if(age<55||bonus(age)!==0||fractionalEndpoint){raw=round3(raw*(1+pastInterest/100))+previous;cap+=previous!==0?.25:0;}
    }
  past.push({age,raw,cap,coefficient:type==='1e'?Math.min(raw,cap):raw,bonus:age<retirementAge?bonus(age):null});
 }
 const pastAt=age=>{const low=Math.floor(age),fraction=age-low;const a=past.find(p=>p.age===low),b=fraction?past.find(p=>p.age===low+1):a;return a.coefficient*(1-fraction)+b.coefficient*fraction;};
 const targetPension=pastAt(retirementAge)*rateAt(retirementAge);
 const targets=[];for(let age=58;age<retirementAge;age++)targets.push(age);targets.push(retirementAge);
 const costs=targets.map(age=>({age,conversion:rateAt(age),pension:pastAt(age)*rateAt(age),capital:round3((targetPension-pastAt(age)*rateAt(age))/rateAt(age))}));
 // At target retirement age: rounded capital to compensate the pension difference.
 // Before that age: annual compound discount. Beyond target: not applicable.
 const future=past.map(row=>({age:row.age,coefficients:costs.map(c=>{
  if(row.age>c.age)return 0;
  // Excel propagates backwards only while the current year's savings rate is nonzero.
  for(let age=row.age;age<c.age;age++)if(bonus(age)===0)return 0;
  return c.capital/Math.pow(1+futureInterest/100,c.age-row.age);
 })}));
 return {input:{...input,brackets:sorted},start,past,targets,costs,future,targetPension,regulatoryCoefficient:pastAt(retirementAge)};
}

function parseFinancedDate(value){
 const match=/^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value.trim());
 if(!match)throw Error('Saisis les dates au format jj.mm.aaaa.');
 const [day,month,year]=match.slice(1).map(Number),date=new Date(0);
 date.setFullYear(year,month-1,day);date.setHours(0,0,0,0);
 if(year<1900||date.getFullYear()!==year||date.getMonth()!==month-1||date.getDate()!==day)throw Error('Date invalide.');
 return date;
}
// Independent copy of the 105% monthly convention: interest on January's base,
// not monthly compound interest. No automatic purchase added to initial balance.
function projectFinancedAssets({birth,start,end,initial,salary,interest,brackets}){
 const bonusFor=age=>{
  const hits=brackets.filter(b=>age>=b.from&&age<=b.to);
  if(hits.length!==1)throw Error(`Une seule tranche doit couvrir l’âge LPP ${age}.`);
  return hits[0].rate;
 };
 let balance=initial;
 const fraction=start.getMonth()/12;
 const initialBonus=salary*bonusFor(start.getFullYear()-birth.getFullYear())/100;
 let base=(balance-initialBonus*fraction)/(1+interest/100*fraction);
 if(base<0)throw Error('Reconstitution du 1er janvier impossible avec cet avoir.');
 const months=[];
 for(let cursor=new Date(start);cursor<=end;cursor=new Date(cursor.getFullYear(),cursor.getMonth()+1,1)){
  if(cursor.getMonth()===0&&cursor.getTime()!==start.getTime())base=balance;
  const date=new Date(cursor.getFullYear(),cursor.getMonth()+1,0);
  const bonus=salary*bonusFor(date.getFullYear()-birth.getFullYear())/100/12;
  const monthlyInterest=base*interest/100/12;
  balance+=monthlyInterest+bonus;
  if(!Number.isFinite(balance))throw Error('Projection hors limites.');
  months.push({date,balance,interest:monthlyInterest,bonus,lppAge:date.getFullYear()-birth.getFullYear()});
 }
 return months;
}
function buildProjectedPurchaseMaximums({birth,start,initial,salary,interest,brackets,rates,retirementAge,minimumAge}){
 const validDate=d=>d instanceof Date&&Number.isFinite(d.getTime());
 if(!validDate(birth)||!validDate(start)||start<=birth||start.getDate()!==1)throw Error('La date de l’avoir doit être le premier jour du mois, après la naissance.');
 if(![initial,salary,interest].every(v=>Number.isFinite(v)&&v>=0)||interest>100)throw Error('Avoir et salaire positifs ou nuls requis ; intérêt de 0 à 100 %.');
 const toMonths=age=>{const m=Math.round(age*12);if(!Number.isFinite(age)||Math.abs(m-age*12)>1e-8)throw Error('Les âges doivent correspondre à un nombre entier de mois.');return m;};
 const regulatoryMonths=toMonths(retirementAge),minimumMonths=toMonths(minimumAge);
 if(minimumAge<58||retirementAge>70||minimumAge>retirementAge)throw Error('L’âge anticipé doit être compris entre 58 ans et l’âge réglementaire (maximum 70 ans).');
 if(!brackets.length||brackets.some(b=>!Number.isInteger(b.from)||!Number.isInteger(b.to)||b.from>b.to||!Number.isFinite(b.rate)||b.rate<0||b.rate>100))throw Error('Vérifie les tranches de bonification et leurs taux (0 à 100 %).');
 const ageMonths=date=>(date.getFullYear()-birth.getFullYear())*12+date.getMonth()-birth.getMonth();
 const endAt=months=>new Date(birth.getFullYear(),birth.getMonth()+months+1,0);
 const end=endAt(regulatoryMonths);
 if(start>end)throw Error('La date de l’avoir est postérieure à la retraite réglementaire.');
 for(let age=start.getFullYear()-birth.getFullYear();age<=end.getFullYear()-birth.getFullYear();age++)if(brackets.filter(b=>age>=b.from&&age<=b.to).length!==1)throw Error(`Une seule tranche doit couvrir l’âge LPP ${age}.`);
 const conversionAt=months=>{
  const low=Math.floor(months/12),rem=months%12,lower=rates[low],upper=rem?rates[low+1]:lower;
  if(![lower,upper].every(v=>Number.isFinite(v)&&v>0&&v<=100))throw Error(`Taux de conversion strictement positif requis à ${low}${rem?' et '+(low+1):''} ans.`);
  return (lower*(12-rem)+upper*rem)/12;
 };
 const projection=projectFinancedAssets({birth,start,end,initial,salary,interest,brackets});
 const regulatoryBalance=projection.at(-1).balance,regulatoryConversion=conversionAt(regulatoryMonths);
 const regulatoryPension=regulatoryBalance*regulatoryConversion/100;
 const startMonths=ageMonths(start),firstMonths=Math.max(minimumMonths,startMonths);
 const targetMonths=[firstMonths];
 for(let m=(Math.floor(firstMonths/12)+1)*12;m<regulatoryMonths;m+=12)targetMonths.push(m);
 if(firstMonths!==regulatoryMonths)targetMonths.push(regulatoryMonths);
 const endpoints=targetMonths.map(months=>{
  // When the minimum date is already reached, use the actual opening balance,
  // not a balance with an extra month's accrual at the purchase date.
  const atStart=months===startMonths&&minimumMonths<=startMonths&&months!==regulatoryMonths;
  const date=atStart?new Date(start):endAt(months);
  const row=projection.find(p=>ageMonths(p.date)===months);
  const balance=atStart?initial:row.balance,conversion=conversionAt(months);
  const pension=balance*conversion/100,delta=regulatoryPension-pension;
  const maximum=delta/(conversion/100);
  if(![pension,delta,maximum].every(Number.isFinite))throw Error('Montant projeté hors limites.');
  return {months,date,balance,conversion,pension,delta,maximum};
 });
 return {birth,start,initial,salary,interest,projection,endpoints,firstMonths,regulatoryMonths,regulatoryDate:end,regulatoryBalance,regulatoryConversion,regulatoryPension};
}
// Stage 2 deliberately operates only on the maxima from stage 1.
function financeProjectedMaximums(maximums,{lastPurchase,previousPurchases}){
 if(![lastPurchase,previousPurchases].every(v=>Number.isFinite(v)&&v>=0))throw Error('Les montants des rachats doivent être positifs ou nuls.');
 const endpoints=maximums.endpoints.map(p=>({...p,remaining:Math.max(0,p.maximum-previousPurchases)}));
 const candidates=[];
 for(let months=maximums.firstMonths;months<=maximums.regulatoryMonths;months++){
  const upper=endpoints.find(p=>p.months>=months),lower=[...endpoints].reverse().find(p=>p.months<=months);
  const w=upper.months===lower.months?0:(months-lower.months)/(upper.months-lower.months);
  const required=lower.remaining*(1-w)+upper.remaining*w;
  const maximum=lower.maximum*(1-w)+upper.maximum*w;
  const date=months===maximums.firstMonths?new Date(endpoints[0].date):new Date(maximums.birth.getFullYear(),maximums.birth.getMonth()+months+1,0);
  const effectiveDate=new Date(date.getFullYear(),date.getMonth()+1,1);
  candidates.push({months,date,effectiveDate,maximum,required,funded:required<=lastPurchase,balance:lastPurchase-required});
 }
 return {endpoints,candidates,financed:candidates.find(c=>c.funded)||null,lastPurchase,previousPurchases};
}
function calculateFinancedDate(tables,{birth,purchaseDate,lastPurchase,previousPurchases,salary}){
 if(!(birth instanceof Date)||!(purchaseDate instanceof Date)||!Number.isFinite(birth.getTime())||!Number.isFinite(purchaseDate.getTime())||purchaseDate<=birth)throw Error('Vérifie la naissance et la date du dernier rachat.');
 if(![lastPurchase,previousPurchases,salary].every(Number.isFinite)||lastPurchase<0||previousPurchases<0||salary<=0)throw Error('Les rachats doivent être positifs ou nuls et le salaire assuré strictement positif.');
 const retirementMonths=Math.round(tables.input.retirementAge*12);
 if(Math.abs(retirementMonths-tables.input.retirementAge*12)>1e-8)throw Error('L’âge réglementaire doit correspondre à un nombre entier de mois.');
 // Excel uses Jan 1 of the birth year, and the first day of the purchase month.
 const purchaseAge=purchaseDate.getFullYear()-birth.getFullYear()+purchaseDate.getMonth()/12;
 const low=Math.floor(purchaseAge),fraction=purchaseAge-low;
 const a=tables.future.find(r=>r.age===low),b=fraction?tables.future.find(r=>r.age===low+1):a;
 if(!a||!b)throw Error('L’âge LPP au rachat doit être couvert par la tabelle (16 à 70 ans).');
 const endpoints=tables.targets.map((age,index)=>{
  const coefficient=a.coefficients[index]*(1-fraction)+b.coefficients[index]*fraction;
  const maximum=salary*coefficient;
  return {months:Math.round(age*12),coefficient,maximum,remaining:Math.max(0,maximum-previousPurchases)};
 });
 const firstDate=months=>new Date(birth.getFullYear(),birth.getMonth()+months+1,1);
 const regulatoryDate=firstDate(retirementMonths);
 if(purchaseDate>regulatoryDate)throw Error('Le dernier rachat est postérieur à la date de retraite réglementaire.');
 const candidates=[];
 for(let months=58*12;months<=retirementMonths;months++){
  const date=firstDate(months);if(date<purchaseDate)continue;
  const upper=endpoints.find(p=>p.months>=months),lower=[...endpoints].reverse().find(p=>p.months<=months);
  if(!upper||!lower)throw Error('Interpolation hors de la tabelle.');
  const weight=upper.months===lower.months?0:(months-lower.months)/(upper.months-lower.months);
  // Match Excel: deduct prior purchases at each annual endpoint, then interpolate monthly.
  const required=lower.remaining*(1-weight)+upper.remaining*weight;
  const maximum=lower.maximum*(1-weight)+upper.maximum*weight;
  const funded=required<=lastPurchase;
  candidates.push({date,months,required,maximum,funded,balance:lastPurchase-required});
 }
 const financed=candidates.find(c=>c.funded)||null;
 return {financed,candidates,endpoints,purchaseAge,regulatoryDate,totalPurchases:lastPurchase+previousPurchases,lastPurchase,previousPurchases,salary};
}