function esc(v: unknown): string {
  return String(v ?? "").normalize("NFKD").replace(/[^\x20-\x7E]/g, "?").replace(/\\/g,"\\\\").replace(/\(/g,"\\(").replace(/\)/g,"\\)");
}
export function createMarksheetPdf(input: {
  institutionName: string; studentName: string; enrollmentNumber?: string|null;
  program?: string|null; department?: string|null; semester?: string|null;
  examination: string; sessionCode: string;
  rows: Array<{ code:string; name:string; marks:number|null; max:number; pass:number; absent:boolean }>;
}): Buffer {
  const lines:Array<{t:string;x:number;y:number;s:number;b?:boolean}>=[];
  const add=(t:unknown,x:number,y:number,s:number,b=false)=>lines.push({t:esc(t),x,y,s,b});
  add(input.institutionName,50,790,18,true);
  add("OFFICIAL MARKSHEET",215,752,15,true);
  add(input.examination,50,725,11,true);
  add("Session: "+input.sessionCode,50,705,9);
  add("Student: "+input.studentName,50,680,10,true);
  if(input.enrollmentNumber) add("Enrollment: "+input.enrollmentNumber,50,662,9);
  if(input.program) add("Program: "+input.program,50,644,9);
  if(input.department) add("Department: "+input.department,50,626,9);
  if(input.semester) add("Semester: "+input.semester,50,608,9);
  add("SUBJECT / PAPER",50,575,9,true); add("MAX",380,575,9,true); add("PASS",430,575,9,true); add("MARKS",480,575,9,true);
  let y=555;
  let total=0,maxTotal=0;
  for(const row of input.rows.slice(0,28)){
    add((row.code+" — "+row.name).slice(0,52),50,y,8);
    add(row.max,380,y,8); add(row.pass,430,y,8); add(row.absent ? "AB" : row.marks,480,y,8,true);
    if(!row.absent && row.marks!==null) total+=row.marks; maxTotal+=row.max; y-=18;
  }
  const pct=maxTotal?((total/maxTotal)*100):0;
  y=Math.max(y-12,100);
  add("TOTAL",50,y,10,true); add(total+" / "+maxTotal,380,y,10,true);
  add("PERCENTAGE",50,y-22,9,true); add(pct.toFixed(2)+"%",380,y-22,9,true);
  add("RESULT STATUS",50,y-44,9,true); add(input.rows.some(r=>!r.absent && r.marks!==null && r.marks<r.pass) ? "FAIL" : "PASS",380,y-44,9,true);
  add("SGPA / CGPA",50,y-66,9,true); add("As per institutional grade scheme / transcript",380,y-66,8);
  add("This is an official result document generated from published examination marks.",50,55,7);
  const content=["q","50 55 495 705 re S","50 675 495 2 re f","0 0 0 rg",...lines.map(l=>"BT /"+(l.b?"F2":"F1")+" "+l.s+" Tf "+l.x+" "+l.y+" Td ("+l.t+") Tj ET"),"Q"].join("\n");
  const objects=[
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>",
    "<< /Length "+Buffer.byteLength(content,"latin1")+" >>\nstream\n"+content+"\nendstream",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>"
  ];
  let out="%PDF-1.4\n";const offsets=[0];
  for(let i=0;i<objects.length;i++){offsets.push(Buffer.byteLength(out,"latin1"));out+=(i+1)+" 0 obj\n"+objects[i]+"\nendobj\n";}
  const x=Buffer.byteLength(out,"latin1");out+="xref\n0 "+(objects.length+1)+"\n0000000000 65535 f \n";
  for(let i=1;i<=objects.length;i++)out+=String(offsets[i]).padStart(10,"0")+" 00000 n \n";
  out+="trailer\n<< /Size "+(objects.length+1)+" /Root 1 0 R >>\nstartxref\n"+x+"\n%%EOF\n";
  const buf=Buffer.from(out,"latin1");if(buf.length<500||!buf.subarray(0,8).toString("ascii").startsWith("%PDF-1."))throw new Error("Marksheet PDF generation produced an invalid document.");
  return buf;
}