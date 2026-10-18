const H=3600000,NOW=Date.UTC(2026,9,18,16,0,5);
function rows({n=399,now=NOW,direction=1,swings=true}={}){const end=Math.floor(now/H)*H;return Array.from({length:n},(_,i)=>{const time=end-(n-i)*H,base=100+i*.2+(swings?Math.sin(i/4)*1.8:0),close=direction===0?100:direction===1?base:400-base,open=close-(direction||1)*.05;return{time,end:time+H,knownAt:time+H,open,close,high:Math.max(open,close)+.1,low:Math.min(open,close)-.1,volume:100};});}
module.exports={rows,H,NOW};
