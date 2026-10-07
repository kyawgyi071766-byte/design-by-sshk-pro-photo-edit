const MODEL=process.env.REPLICATE_MODEL||"black-forest-labs/flux-kontext-pro";
const send=(res,s,b)=>res.status(s).setHeader("content-type","application/json").json(b);
module.exports=async function handler(req,res){
 if(req.method==="GET")return send(res,200,{ok:true,service:"SSHK AI",model:MODEL});
 if(req.method!=="POST")return send(res,405,{ok:false,error:"Method not allowed"});
 const {put}=await import("@vercel/blob"); const {neon}=await import("@neondatabase/serverless");
 const dbUrl=process.env.STORAGE_DATABASE_URL||process.env.DATABASE_URL,t=process.env.REPLICATE_API_TOKEN,bt=process.env.BLOB_READ_WRITE_TOKEN;
 if(!dbUrl||!t||!bt)return send(res,500,{ok:false,error:"Missing AI/storage/database environment"});
 const sql=neon(dbUrl),id=crypto.randomUUID(),body=req.body||{},prompt=body.prompt||"Create a realistic professional photo.",image=body.inputImage||null,operation=body.operation||"edit";
 try{
  await sql\`create table if not exists sshk_ai_jobs(id text primary key,status text,prompt text,model text,operation text,replicate_prediction_id text,blob_path text,error text,created_at timestamptz default now(),completed_at timestamptz)\`;
  await sql\`insert into sshk_ai_jobs(id,status,prompt,model,operation) values(\${id},'processing',\${prompt},\${MODEL},\${operation})\`;
  const input={prompt,aspect_ratio:"match_input_image",output_format:"png",safety_tolerance:2};
  if(image){if(typeof image!=="string"||image.length>1300000)throw Error("Input image is too large");input.input_image=image}
  const cr=await fetch("https://api.replicate.com/v1/models/"+MODEL+"/predictions",{method:"POST",headers:{Authorization:"Bearer "+t,"Content-Type":"application/json","Prefer":"wait=55"},body:JSON.stringify({input})});
  let p=await cr.json();if(!cr.ok)throw Error(p.detail||p.error||"Replicate create failed");
  await sql\`update sshk_ai_jobs set replicate_prediction_id=\${p.id} where id=\${id}\`;
  for(let i=0;i<45&&!["succeeded","failed","canceled"].includes(p.status);i++){await new Promise(r=>setTimeout(r,1500));p=await (await fetch("https://api.replicate.com/v1/predictions/"+p.id,{headers:{Authorization:"Bearer "+t}})).json()}
  if(p.status!=="succeeded")throw Error(p.error||("Replicate status: "+p.status));
  const out=Array.isArray(p.output)?p.output[0]:p.output,url=typeof out==="string"?out:(out&&out.url?.())||(out&&out.url);
  if(!url)throw Error("No output URL");
  const bin=Buffer.from(await (await fetch(url)).arrayBuffer()),path="design-by-sshk/ai-output/"+id+".png";
  const blob=await put(path,bin,{access:"private",addRandomSuffix:false,token:bt,contentType:"image/png"});
  await sql\`update sshk_ai_jobs set status='completed',blob_path=\${blob.pathname},completed_at=now() where id=\${id}\`;
  return send(res,200,{ok:true,jobId:id,status:"completed",predictionId:p.id,blobPath:blob.pathname,blobUrl:blob.url,outputDataUrl:"data:image/png;base64,"+bin.toString("base64")});
 }catch(e){await sql\`update sshk_ai_jobs set status='failed',error=\${String(e?.message||e)} where id=\${id}\`.catch(()=>{});return send(res,500,{ok:false,jobId:id,error:String(e?.message||e)})}
}