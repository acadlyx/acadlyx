const api=process.env.ACADLYX_API_URL||"http://localhost:5001";
const roles=["SUPER_ADMIN","INSTITUTION_ADMIN","MANAGEMENT","HOD","FACULTY","EXAMINATION","ACCOUNTS","STUDENT","PARENT"];
const tokenFor=(role)=>process.env["ACADLYX_"+role+"_TOKEN"];
const checks=[["/api/v1/auth/me",200],["/api/v1/workspace/context",200]];
let failures=0;
for(const role of roles){
  const token=tokenFor(role);
  if(!token){console.log(JSON.stringify({role,status:"skipped",reason:"missing token"}));continue;}
  for(const [path,expected] of checks){
    const res=await fetch(api+path,{headers:{Authorization:"Bearer "+token,Accept:"application/json"}});
    const ok=res.status===expected;
    console.log(JSON.stringify({role,path,status:res.status,ok}));
    if(!ok) failures++;
  }
}
if(failures) process.exit(1);
