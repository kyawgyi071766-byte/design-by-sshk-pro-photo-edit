module.exports=async function(req,res){
 res.setHeader("content-type","application/json");
 const env={replicate:!!process.env.REPLICATE_API_TOKEN,blob:!!process.env.BLOB_READ_WRITE_TOKEN,database:!!(process.env.STORAGE_DATABASE_URL||process.env.DATABASE_URL)};
 let db=false,table=false,error=null;
 try{
  if(env.database){
   const {neon}=require("@neondatabase/serverless");
   const sql=neon(process.env.STORAGE_DATABASE_URL||process.env.DATABASE_URL);
   await sql`select 1`; db=true;
   await sql`create table if not exists sshk_ai_jobs(id text primary key,status text,prompt text,model text,operation text,replicate_prediction_id text,blob_path text,error text,access_token_hash text,created_at timestamptz default now(),completed_at timestamptz)`;
   const rows=await sql`select to_regclass('public.sshk_ai_jobs') as table_name`;
   table=!!rows[0]?.table_name;
  }
 }catch(e){error=String(e?.message||e).slice(0,300)}
 res.statusCode=200;
 res.end(JSON.stringify({ok:env.replicate&&env.blob&&env.database&&db&&table,service:"SSHK health",env,db,table,error,model:process.env.REPLICATE_MODEL||"black-forest-labs/flux-kontext-pro"}));
};