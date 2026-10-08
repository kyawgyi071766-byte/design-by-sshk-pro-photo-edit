const {put}=require("@vercel/blob");
const {neon}=require("@neondatabase/serverless");
const crypto=require("crypto");
const MODEL=process.env.REPLICATE_MODEL||"black-forest-labs/flux-kontext-pro";
const MAX_WAIT_MS=Math.min(300000,Math.max(10000,Number(process.env.AI_MAX_WAIT_MS||120000)));
const MAX_PROMPT=4000,MAX_IMAGE=1300000;
const OPS=new Set(["edit","enhance","remove","expand","restore","generate"]);
function send(res,status,body){res.statusCode=status;res.setHeader("content-type","application/json");res.setHeader("cache-control","no-store");res.end(JSON.stringify(body))}
function hash(v){return crypto.createHash("sha256").update(v).digest("hex")}
function validDataImage(v){return typeof v==="string"&&/^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/.test(v)}
function hostAllowed(u){try{const h=new URL(u).hostname;return h==="replicate.delivery"||h.endsWith(".replicate.delivery")}catch{return false}}
module.exports=async function(req,res){
 if(req.method==="GET")return send(res,200,{ok:true,service:"SSHK AI",model:MODEL,operations:[...OPS]});
 if(req.method!=="POST")return send(res,405,{ok:false,error:"Method not allowed"});
 const dbUrl=process.env.STORAGE_DATABASE_URL||process.env.DATABASE_URL,replicateToken=process.env.REPLICATE_API_TOKEN,blobToken=process.env.BLOB_READ_WRITE_TOKEN;
 if(!dbUrl||!replicateToken||!blobToken)return send(res,500,{ok:false,error:"Missing production AI/storage/database environment"});
 const body=req.body&&typeof req.body==="object"?req.body:{};
 const prompt=typeof body.prompt==="string"&&body.prompt.trim()?body.prompt.trim():"Create a realistic professional photo.";
 const operation=typeof body.operation==="string"?body.operation:"edit";
 const image=body.inputImage||null;
 if(prompt.length>MAX_PROMPT)return send(res,413,{ok:false,error:"Prompt is too long"});
 if(!OPS.has(operation))return send(res,400,{ok:false,error:"Unsupported AI operation"});
 if(image!==null&&(!validDataImage(image)||image.length>MAX_IMAGE))return send(res,413,{ok:false,error:"Input image must be a supported base64 data image under 1.3MB"});
 const sql=neon(dbUrl),id=crypto.randomUUID(),accessToken=crypto.randomBytes(32).toString("hex"),accessHash=hash(accessToken);
 try{
  await sql`create table if not exists sshk_ai_jobs(id text primary key,status text,prompt text,model text,operation text,replicate_prediction_id text,blob_path text,error text,access_token_hash text,created_at timestamptz default now(),completed_at timestamptz)`;
  await sql`alter table sshk_ai_jobs add column if not exists access_token_hash text`;
  await sql`insert into sshk_ai_jobs(id,status,prompt,model,operation,access_token_hash) values(${id},'processing',${prompt},${MODEL},${operation},${accessHash})`;
  const input={prompt,aspect_ratio:"match_input_image",output_format:"png",safety_tolerance:2};
  if(image)input.input_image=image;
  const cr=await fetch("https://api.replicate.com/v1/models/"+encodeURIComponent(MODEL)+"/predictions",{method:"POST",headers:{Authorization:"Bearer "+replicateToken,"Content-Type":"application/json","Prefer":"wait=55"},body:JSON.stringify({input})});
  let prediction=await cr.json();
  if(!cr.ok)throw Error(prediction.detail||prediction.error||"Replicate create failed");
  await sql`update sshk_ai_jobs set replicate_prediction_id=${prediction.id} where id=${id}`;
  const deadline=Date.now()+MAX_WAIT_MS;
  while(Date.now()<deadline&&!["succeeded","failed","canceled"].includes(prediction.status)){
   await new Promise(r=>setTimeout(r,1500));
   const pr=await fetch(prediction.urls?.get||("https://api.replicate.com/v1/predictions/"+prediction.id),{headers:{Authorization:"Bearer "+replicateToken}});
   prediction=await pr.json();
  }
  if(prediction.status!=="succeeded")throw Error(prediction.error||("Replicate status: "+prediction.status));
  const out=Array.isArray(prediction.output)?prediction.output[0]:prediction.output;
  const outputUrl=typeof out==="string"?out:(out&&out.url?out.url:null);
  if(!outputUrl||!hostAllowed(outputUrl))throw Error("Replicate returned an unsupported output URL");
  const outputResponse=await fetch(outputUrl);
  if(!outputResponse.ok)throw Error("Could not download Replicate output");
  const contentType=(outputResponse.headers.get("content-type")||"image/png").split(";")[0];
  if(!/^image\/(png|jpeg|webp)$/.test(contentType))throw Error("AI output is not an image");
  const buffer=Buffer.from(await outputResponse.arrayBuffer());
  if(buffer.length>15*1024*1024)throw Error("AI output is too large");
  const ext=contentType==="image/jpeg"?"jpg":contentType==="image/webp"?"webp":"png";
  const blobPath="design-by-sshk/ai-output/"+id+"."+ext;
  const blob=await put(blobPath,buffer,{access:"private",addRandomSuffix:false,token:blobToken,contentType});
  await sql`update sshk_ai_jobs set status='completed',blob_path=${blob.pathname},completed_at=now() where id=${id}`;
  return send(res,200,{ok:true,jobId:id,status:"completed",predictionId:prediction.id,blobPath:blob.pathname,outputUrl:"/api/output?job="+encodeURIComponent(id)+"&token="+encodeURIComponent(accessToken),jobStatusUrl:"/api/job?job="+encodeURIComponent(id)+"&token="+encodeURIComponent(accessToken)});
 }catch(error){
  const message=String(error?.message||error).slice(0,1000);
  await sql`update sshk_ai_jobs set status='failed',error=${message} where id=${id}`.catch(()=>{});
  return send(res,500,{ok:false,jobId:id,error:message});
 }
};