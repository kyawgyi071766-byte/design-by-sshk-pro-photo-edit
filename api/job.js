const {neon}=require("@neondatabase/serverless");
const crypto=require("crypto");
function send(res,status,body){res.statusCode=status;res.setHeader("content-type","application/json");res.setHeader("cache-control","no-store");res.end(JSON.stringify(body))}
module.exports=async function(req,res){
 if(req.method!=="GET")return send(res,405,{ok:false,error:"Method not allowed"});
 const id=typeof req.query?.job==="string"?req.query.job:"";
 const token=typeof req.query?.token==="string"?req.query.token:"";
 const dbUrl=process.env.STORAGE_DATABASE_URL||process.env.DATABASE_URL;
 if(!id||!token||!dbUrl)return send(res,400,{ok:false,error:"Missing job capability"});
 try{
  const sql=neon(dbUrl),hash=crypto.createHash("sha256").update(token).digest("hex");
  const rows=await sql`select id,status,operation,model,replicate_prediction_id,blob_path,error,created_at,completed_at,access_token_hash from sshk_ai_jobs where id=${id} limit 1`;
  const j=rows[0];
  if(!j||j.access_token_hash!==hash)return send(res,404,{ok:false,error:"Job not found"});
  return send(res,200,{ok:true,jobId:j.id,status:j.status,operation:j.operation,model:j.model,predictionId:j.replicate_prediction_id,blobPath:j.status==="completed"?j.blob_path:null,error:j.status==="failed"?j.error:null,createdAt:j.created_at,completedAt:j.completed_at,outputUrl:j.status==="completed"?"/api/output?job="+encodeURIComponent(id)+"&token="+encodeURIComponent(token):null});
 }catch(e){return send(res,500,{ok:false,error:String(e?.message||e)})}
};