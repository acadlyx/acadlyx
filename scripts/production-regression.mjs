const api=process.env.ACADLYX_API_URL||"https://acadlyx-api.onrender.com";
const web=process.env.ACADLYX_WEB_URL||"https://acadlyx-orcin.vercel.app";
async function check(url,expected){const started=performance.now();const res=await fetch(url,{redirect:"follow"});const text=await res.text();const ok=res.status===expected;console.log(JSON.stringify({url,status:res.status,ms:Math.round(performance.now()-started),ok,bytes:text.length}));if(!ok)throw new Error(url+" returned "+res.status);}
await check(api+"/api/v1/health",200);
await check(api+"/api/v1/health/ready",200);
await check(web,200);
