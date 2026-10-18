// Geschlossene, deterministische OHLCV: bestätigter Trend, 53,7%-Rücksetzer und 15m-Engulfing.
const {fixture:original}=require('./analysis-fixture'),H=3600000,Q=900000,NOW=Date.UTC(2026,9,18,16,15)+5000;
function rows(n,ms,end){return Array.from({length:n},(_,i)=>{const close=100+i*.025+Math.sin(i*.4)*.15;return{time:end-(n-i)*ms,end:end-(n-1-i)*ms,knownAt:end-(n-1-i)*ms,open:close-.02,close,high:close+.12,low:close-.14,volume:100};});}
function fixture(direction=1){
const hour=rows(500,H,Math.floor(NOW/H)*H);Object.assign(hour[480],{open:111.3,close:111.2,high:111.4,low:110.7});
for(let i=481;i<=497;i++){const close=111.1+(i-481)*.12;Object.assign(hour[i],{open:close-.07,close,high:close+.12,low:close-.14});}
Object.assign(hour[497],{open:112.9,close:113.1,high:113.4,low:112.85});Object.assign(hour[498],{open:113.1,close:112.6,high:113.15,low:112.0});Object.assign(hour[499],{open:112.6,close:112.4,high:112.65,low:111.95});
const lower=rows(500,Q,Math.floor(NOW/Q)*Q).map((c,i)=>{const close=112.2+Math.sin(i*.3)*.08;return{...c,open:close-.01,close,high:close+.06,low:close-.06};});Object.assign(lower[498],{open:112.25,close:112.15,high:112.28,low:112.1});Object.assign(lower[499],{open:112.1,close:112.4,high:112.45,low:112.05});
const higher=original().candles['4h'].map((c,i)=>({...c,time:Math.floor(NOW/(4*H))*4*H-(500-i)*4*H,end:Math.floor(NOW/(4*H))*4*H-(499-i)*4*H,knownAt:Math.floor(NOW/(4*H))*4*H-(499-i)*4*H}));
const input={candles:{'4h':higher,'1h':hour,'15m':lower},now:NOW,symbol:'BTCUSDT',market:'spot'};
if(direction===-1)for(const cs of Object.values(input.candles))for(const c of cs){const h=c.high,l=c.low;c.open=224.8-c.open;c.close=224.8-c.close;c.high=224.8-l;c.low=224.8-h;}
return input;
}
module.exports={fixture,NOW,H,Q};
