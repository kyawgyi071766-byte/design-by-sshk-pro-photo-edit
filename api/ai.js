const {put}=require("@vercel/blob");
const {neon}=require("@neondatabase/serverless");
const MODEL=process.env.REPLICATE_MODEL||"black-forest-labs/flux-kontext-pro";
function send(res,status,body){res.statusCode=status;res.setHeader("content-type","application/json");res.end(JSON.stringify(body))}
module.exports=async function(req,res){
 if(req.method==="GET")return send(res,200,{ok:true,service:"SSHK AI",model:MODEL});
 if(req.method!=="POST")return send(res,405,{ok:false,error:"Method not allowed"});
 const dbUrl=process.env.STORAGE_DATABASE_URL||process.env.DATABASE_URL;
 const token=process.env.REPLICATE_API_TOKEN;
 const blobToken=process.env.BLOB_READ_WRITE_TOKEN;
 if(!dbUrl||!token||!blobToken)return send(res,500,{ok:false,error:"Missing production AI/storage/database environment"});
 const sql=neon(dbUrl);
 const id=crypto.randomUUID();
 const accessToken=crypto.randomBytes(32).toString("hex");
 const accessHash=crypto.createHash("sha256").update(accessToken).digest("hex");
 const body=req.body||{};
 const prompt=typeof body.prompt==="string"&&body.prompt.trim()?body.prompt.trim():"Create a realistic professional photo.";
 const image=body.inputImage||null;
 const operation=body.operation||"edit";
 try{
  await sql`create table if not exists sshk_ai_jobs(id text primary key,status text,prompt text,model text,operation text,replicate_prediction_id text,blob_path text,error text,access_token_hash text,created_at timestamptz default now(),completed_at timestamptz)`;
  await sql`alter table sshk_ai_jobs add column if not exists access_token_hash text`;
  await sql`insert into sshk_ai_jobs(id,status,prompt,model,operation,access_token_hash) values(${id},'processing',${prompt},${MODEL},${operation},${accessHash})`;
  const input={prompt,aspect_ratio:"match_input_image",output_format:"png",safety_tolerance:2};
  if(image){
   if(typeof image!=="string"||image.length>1300000)throw Error("Input image is too large");
   input.input_image=image;
  }
  const cr=await fetch("https://api.replicate.com/v1/models/"+MODEL+"/predictions",{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json","Prefer":"wait=55"},body:JSON.stringify({input})});
  let prediction=await cr.json();
  if(!cr.ok)throw Error(prediction.detail||prediction.error||"Replicate create failed");
  await sql`update sshk_ai_jobs set replicate_prediction_id=${prediction.id} where id=${id}`;
  for(let i=0;i<45&&!["succeeded","failed","canceled"].includes(prediction.status);i++){
   await new Promise(r=>setTimeout(r,1500));
   const pr=await fetch("https://api.replicate.com/v1/predictions/"+prediction.id,{headers:{Authorization:"Bearer "+token}});
   prediction=await pr.json();
  }
  if(prediction.status!=="succeeded")throw Error(prediction.error||("Replicate status: "+prediction.status));
  const out=Array.isArray(prediction.output)?prediction.output[0]:prediction.output;
  const outputUrl=typeof out==="string"?out:(out&&out.url?out.url:null);
  if(!outputUrl)throw Error("Replicate returned no output URL");
  const outputResponse=await fetch(outputUrl);
  if(!outputResponse.ok)throw Error("Could not download Replicate output");
  const buffer=Buffer.from(await outputResponse.arrayBuffer());
  const blobPath="design-by-sshk/ai-output/"+id+".png";
  const blob=await put(blobPath,buffer,{access:"private",addRandomSuffix:false,token:blobToken,contentType:"image/png"});
  await sql`update sshk_ai_jobs set status='completed',blob_path=${blob.pathname},completed_at=now() where id=${id}`;
  return send(res,200,{ok:true,jobId:id,status:"completed",predictionId:prediction.id,blobPath:blob.pathname,blobUrl:blob.url,outputUrl:"/api/output?job="+encodeURIComponent(id)+"&token="+encodeURIComponent(accessToken)});
 }catch(error){
  const message=String(error&&error.message||error);
  await sql`update sshk_ai_jobs set status='failed',error=${message} where id=${id}`.catch(()=>{});
  return send(res,500,{ok:false,jobId:id,error:message});
 }
};