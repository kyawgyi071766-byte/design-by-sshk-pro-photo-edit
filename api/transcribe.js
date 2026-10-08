const crypto=require("crypto");
const MODEL="openai/whisper:8099696689d249cf8b122d833c36ac3f75505c666a395ca40ef26f68e7d3d16";
const MAX_AUDIO=15*1024*1024;
function send(res,status,body){res.statusCode=status;res.setHeader("content-type","application/json");res.setHeader("cache-control","no-store");res.end(JSON.stringify(body))}
function validAudio(v){return typeof v==="string"&&/^data:audio\/(mpeg|mp3|wav|x-wav|ogg|webm|mp4|m4a|aac);base64,[A-Za-z0-9+/=]+$/.test(v)}
module.exports=async function(req,res){
 if(req.method!=="POST")return send(res,405,{ok:false,error:"Method not allowed"});
 const token=process.env.REPLICATE_API_TOKEN;if(!token)return send(res,500,{ok:false,error:"Missing Replicate environment"});
 const body=req.body&&typeof req.body==="object"?req.body:{},audio=body.audio,language=typeof body.language==="string"?body.language:"auto";
 if(!validAudio(audio)||audio.length>MAX_AUDIO*1.4)return send(res,413,{ok:false,error:"Audio must be a supported base64 data URL under 15MB"});
 try{
  const cr=await fetch("https://api.replicate.com/v1/models/openai/whisper/predictions",{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json","Prefer":"wait=55"},body:JSON.stringify({input:{audio,transcription:"srt",translate:false,language,temperature:0}})});
  let p=await cr.json();if(!cr.ok)throw Error(p.detail||p.error||"Transcription request failed");
  const deadline=Date.now()+240000;
  while(Date.now()<deadline&&!["succeeded","failed","canceled"].includes(p.status)){await new Promise(r=>setTimeout(r,1500));const q=await fetch(p.urls?.get||("https://api.replicate.com/v1/predictions/"+p.id),{headers:{Authorization:"Bearer "+token}});p=await q.json()}
  if(p.status!=="succeeded")throw Error(p.error||("Transcription status: "+p.status));
  let text="",segments=[];
  if(typeof p.output==="string"){text=p.output}
  else if(p.output){text=p.output.transcription||p.output.text||"";segments=Array.isArray(p.output.segments)?p.output.segments:[]}
  return send(res,200,{ok:true,predictionId:p.id,text,segments});
 }catch(e){return send(res,500,{ok:false,error:String(e?.message||e).slice(0,1000)})}
};