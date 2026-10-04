const base=process.env.ACADLYX_API_URL||"http://localhost:5001";
const concurrency=Math.max(1,Math.min(Number(process.env.CONCURRENCY||20),100));
const rounds=Math.max(1,Math.min(Number(process.env.ROUNDS||5),50));
const paths=["/api/v1/health","/api/v1/health/ready"];
async function hit(path){const started=performance.now();const res=await fetch(base+path,{headers:{"Accept":"application/json"}});await res.arrayBuffer();return {path,status:res.status,ms:Math.round(performance.now()-started)};}
for(let round=1;round<=rounds;round++){const results=await Promise.all(Array.from({length:concurrency},(_,i)=>hit(paths[i%paths.length])));const failed=results.filter(r=>r.status>=500);const avg=Math.round(results.reduce((s,r)=>s+r.ms,0)/results.length);const max=Math.max(...results.map(r=>r.ms));console.log(JSON.stringify({round,requests:results.length,failed:failed.length,avgMs:avg,maxMs:max}));if(failed.length)process.exitCode=1;}
