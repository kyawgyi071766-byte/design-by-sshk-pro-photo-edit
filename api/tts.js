const {put}=require("@vercel/blob");
const crypto=require("crypto");
const MODEL="xai/grok-text-to-speech";
function send(res,status,body){res.statusCode=status;res.setHeader("content-type","application/json");res.setHeader("cache-control","no-store");res.end(JSON.stringify(body))}
function hostAllowed(u){try{const h=new URL(u).hostname;return h==="replicate.delivery"||h.endsWith(".replicate.delivery")}catch{return false}}
module.exports=async function(req,res){
 if(req.method!=="POST")return send(res,405,{ok:false,error:"Method not allowed"});
 const token=process.env.REPLICATE_API_TOKEN,blobToken=process.env.BLOB_READ_WRITE_TOKEN;if(!token||!blobToken)return send(res,500,{ok:false,error:"Missing production AI/storage environment"});
 const b=req.body&&typeof req.body==="object"?req.body:{},text=typeof b.text==="string"?b.text.trim():"",voice=typeof b.voice==="string"?b.voice:"ara",language=typeof b.language==="string"?b.language:"auto";
 if(!text||text.length>15000)return send(res,413,{ok:false,error:"Text is required and must be under 15000 characters"});
 try{
  const cr=await fetch("https://api.replicate.com/v1/models/xai/grok-text-to-speech/predictions",{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json","Prefer":"wait=55"},body:JSON.stringify({input:{text,voice,language,output_format:"mp3",sample_rate:24000,bit_rate:128000}})});
  let p=await cr.json();if(!cr.ok)throw Error(p.detail||p.error||"TTS request failed");
  const deadline=Date.now()+240000;
  while(Date.now()<deadline&&!["succeeded","failed","canceled"].includes(p.status)){await new Promise(r=>setTimeout(r,1500));const q=await fetch(p.urls?.get||("https://api.replicate.com/v1/predictions/"+p.id),{headers:{Authorization:"Bearer "+token}});p=await q.json()}
  if(p.status!=="succeeded")throw Error(p.error||("TTS status: "+p.status));
  const out=typeof p.output==="string"?p.output:(p.output?.url?p.output.url:null);if(!out||!hostAllowed(out))throw Error("TTS returned an unsupported output URL");
  const rr=await fetch(out);if(!rr.ok)throw Error("Could not download generated audio");
  const type=(rr.headers.get("content-type")||"audio/mpeg").split(";")[0];if(type!=="audio/mpeg"&&type!=="audio/wav")throw Error("Unsupported TTS output");
  const buf=Buffer.from(await rr.arrayBuffer());if(buf.length>25*1024*1024)throw Error("TTS output too large");
  const path="design-by-sshk/tts/"+crypto.randomUUID()+".mp3";const blob=await put(path,buf,{access:"private",addRandomSuffix:false,token:blobToken,contentType:"audio/mpeg"});
  return send(res,200,{ok:true,predictionId:p.id,blobPath:blob.pathname,sourceUrl:out});
 }catch(e){return send(res,500,{ok:false,error:String(e?.message||e).slice(0,1000)})}
};