// 3.79.0: Kalender und Uhrzeiten ausschließlich in America/New_York; Börsenanker bleiben UTC.
export const NY_ZONE = 'America/New_York';
const clock = new Intl.DateTimeFormat('en-CA', { timeZone: NY_ZONE, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23' });
export function nyParts(at) { return Object.fromEntries(clock.formatToParts(at).filter(p => p.type !== 'literal').map(p => [p.type, Number(p.value)])); }
export function nyDay(at) { const p = nyParts(at); return `${p.year}-${String(p.month).padStart(2,'0')}-${String(p.day).padStart(2,'0')}`; }
const utcDay = day => { if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw Error('Ungültiges NY-Datum'); const t = Date.parse(day+'T00:00:00Z'); if (!Number.isFinite(t) || new Date(t).toISOString().slice(0,10)!==day) throw Error('Ungültiges NY-Datum'); return t; };
export const shiftNyDay = (day, count) => new Date(utcDay(day)+count*86400000).toISOString().slice(0,10);
export function nyTime(day, hour, minute = 0) {
  const target = utcDay(day)+hour*3600000+minute*60000; let guess = target;
  for (let i=0;i<3;i++) { const p=nyParts(guess); const shown=Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second); guess += target-shown; }
  const p=nyParts(guess); if(nyDay(guess)!==day || p.hour!==hour || p.minute!==minute) throw Error('NY-Ortszeit existiert nicht eindeutig'); return guess;
}
const dateKey = t => new Date(t).toISOString().slice(0,10);
const nth = (y,m,weekday,n) => { const first=Date.UTC(y,m-1,1); return dateKey(first+((weekday-new Date(first).getUTCDay()+7)%7+(n-1)*7)*86400000); };
function easter(y) { const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),n=h+l-7*m+114; return dateKey(Date.UTC(y,Math.floor(n/31)-1,n%31+1)); }
const holidayCache = new Map();
export function nyseHolidays(year) {
  if (holidayCache.has(year)) return holidayCache.get(year);
  const days=new Map(), add=(d,label)=>days.set(d,label), observed=(m,d,label,newYear=false)=>{const t=Date.UTC(year,m-1,d),w=new Date(t).getUTCDay();if(w!==6||!newYear)add(dateKey(t+(w===6?-1:w===0?1:0)*86400000),label);};
  observed(1,1,'Neujahr',true); if(year>=1998)add(nth(year,1,1,3),'Martin Luther King Day');
  add(nth(year,2,1,3),'Washington’s Birthday'); add(shiftNyDay(easter(year),-2),'Karfreitag');
  const lastMay=Date.UTC(year,5,0);add(dateKey(lastMay-((new Date(lastMay).getUTCDay()+6)%7)*86400000),'Memorial Day');
  if(year>=2022)observed(6,19,'Juneteenth'); observed(7,4,'Independence Day'); add(nth(year,9,1,1),'Labor Day'); add(nth(year,11,4,4),'Thanksgiving'); observed(12,25,'Weihnachten');
  for(const [d,name] of Object.entries({'2001-09-11':'Sonderschließung','2001-09-12':'Sonderschließung','2001-09-13':'Sonderschließung','2001-09-14':'Sonderschließung','2004-06-11':'Staatstrauer Reagan','2007-01-02':'Staatstrauer Ford','2012-10-29':'Hurrikan Sandy','2012-10-30':'Hurrikan Sandy','2018-12-05':'Staatstrauer Bush','2025-01-09':'Staatstrauer Carter'}))if(d.startsWith(String(year)))add(d,name);
  holidayCache.set(year,days);return days;
}
export function nyTradingDay(day, skipHolidays = true) { const t=utcDay(day), weekday=new Date(t).getUTCDay(), holiday=nyseHolidays(new Date(t).getUTCFullYear()).get(day); return { eligible:weekday!==0&&weekday!==6&&(!skipHolidays||!holiday), reason:weekday===0||weekday===6?'Wochenende':skipHolidays&&holiday?`NYSE geschlossen: ${holiday}`:'Handelstag', holiday:holiday||null }; }
