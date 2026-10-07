const {get}=require("@vercel/blob");
const {neon}=require("@neondatabase/serverless");
function send(res,status,body){res.statusCode=status;res.setHeader("content-type","application/json");res.end(JSON.stringify(body))}
module.exports=async function(req,res){
 if(req.method!=="GET")return send(res,405,{ok:false,error:"Method not allowed"});
 const id=typeof req.query?.job==="string"?req.query.job:"";
 const token=process.env.BLOB_READ_WRITE_TOKEN;
 const dbUrl=process.env.STORAGE_DATABASE_URL||process.env.DATABASE_URL;
 if(!id||!token||!dbUrl)return send(res,400,{ok:false,error:"Missing job or storage configuration"});
 try{
  const sql=neon(dbUrl);
  const rows=await sql`select blob_path,status from sshk_ai_jobs where id=${id} limit 1`;
  const job=rows[0];
  if(!job||job.status!=="completed"||!job.blob_path)return send(res,404,{ok:false,error:"AI output not found"});
  const result=await get(job.blob_path,{access:"private",token,useCache:false});
  if(!result?.stream)return send(res,404,{ok:false,error:"AI output stream unavailable"});
  res.statusCode=200;
  res.setHeader("content-type",result.blob?.contentType||"image/png");
  res.setHeader("cache-control","private, no-store");
  return result.stream.pipe(res);
 }catch(error){return send(res,500,{ok:false,error:String(error&&error.message||error)});}
};