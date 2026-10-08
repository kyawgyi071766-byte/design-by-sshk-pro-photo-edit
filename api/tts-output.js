const {get}=require("@vercel/blob");
const {neon}=require("@neondatabase/serverless");
const crypto=require("crypto");
function send(res,status,body){res.statusCode=status;res.setHeader("content-type","application/json");res.setHeader("cache-control","no-store");res.end(JSON.stringify(body))}
module.exports=async function(req,res){
 if(req.method!=="GET")return send(res,405,{ok:false,error:"Method not allowed"});
 const id=typeof req.query?.job==="string"?req.query.job:"",token=typeof req.query?.token==="string"?req.query.token:"";
 const blobToken=process.env.BLOB_READ_WRITE_TOKEN,dbUrl=process.env.STORAGE_DATABASE_URL||process.env.DATABASE_URL;
 if(!id||!token||!blobToken||!dbUrl)return send(res,400,{ok:false,error:"Missing output capability or storage configuration"});
 try{const sql=neon(dbUrl),hash=crypto.createHash("sha256").update(token).digest("hex");const rows=await sql`select blob_path,status,access_token_hash from sshk_tts_jobs where id=${id} limit 1`;const j=rows[0];if(!j||j.status!=="completed"||!j.blob_path||j.access_token_hash!==hash)return send(res,404,{ok:false,error:"TTS output not found"});const r=await get(j.blob_path,{access:"private",token:blobToken,useCache:false});if(!r?.stream)return send(res,404,{ok:false,error:"TTS stream unavailable"});res.statusCode=200;res.setHeader("content-type",r.blob?.contentType||"audio/mpeg");res.setHeader("cache-control","private, no-store");return r.stream.pipe(res)}catch(e){return send(res,500,{ok:false,error:String(e?.message||e)})}};