const api=process.env.ACADLYX_API_URL||"http://localhost:5001";
const tokenA=process.env.ACADLYX_TENANT_A_TOKEN;
const tokenB=process.env.ACADLYX_TENANT_B_TOKEN;
const foreignId=process.env.ACADLYX_FOREIGN_RESOURCE_ID;
const resourcePath=process.env.ACADLYX_TENANT_PROBE_PATH||"/api/v1/users/";
if(!tokenA||!tokenB||!foreignId){console.log("Tenant probe skipped: provide ACADLYX_TENANT_A_TOKEN, ACADLYX_TENANT_B_TOKEN and ACADLYX_FOREIGN_RESOURCE_ID.");process.exit(0);}
const url=api+resourcePath+encodeURIComponent(foreignId);
for(const [name,token] of [["tenant-a",tokenA],["tenant-b",tokenB]]){
  const res=await fetch(url,{headers:{Authorization:"Bearer "+token,Accept:"application/json"}});
  const ok=res.status===404||res.status===403;
  console.log(JSON.stringify({tenant:name,status:res.status,isolated:ok}));
  if(!ok) process.exitCode=1;
}
