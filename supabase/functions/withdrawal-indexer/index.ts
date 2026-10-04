import { createClient } from "npm:@supabase/supabase-js@2";
const ERC20_TRANSFER_TOPIC="0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55aeb5b6f7e";
function secretKey(){const raw=Deno.env.get("SUPABASE_SECRET_KEYS")||"";try{return JSON.parse(raw).default as string}catch{return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||""}}
function db(){return createClient(Deno.env.get("SUPABASE_URL")!,secretKey())}
async function authorized(client:ReturnType<typeof db>,req:Request){const provided=req.headers.get("x-aura-worker-secret")||"";const {data,error}=await client.rpc("get_aura_worker_secret");return !error&&!!data&&provided.length>0&&provided===data}
const EVM={ethereum:{confirmations:12,rpc:"AURA_EVM_RPC_ETHEREUM",token:"0xdAC17F958D2ee523a2206206994597C13D831ec7"},polygon:{confirmations:30,rpc:"AURA_EVM_RPC_POLYGON",token:"0xc2132D05D31c914a87C6611C10748AEb04B58e8F"},arbitrum:{confirmations:20,rpc:"AURA_EVM_RPC_ARBITRUM",token:"0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9"}} as const;
async function rpc(url:string,method:string,params:unknown[]){const response=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method,params})});if(!response.ok)throw new Error("RPC_HTTP_"+response.status);const payload=await response.json();if(payload.error)throw new Error(payload.error.message||"RPC_ERROR");return payload.result}
function hexToBigInt(v:string|null|undefined){return v?BigInt(v):0n}
Deno.serve(async(req)=>{
 if(req.method!=="POST")return Response.json({error:"METHOD_NOT_ALLOWED"},{status:405});
 const client=db();if(!(await authorized(client,req)))return Response.json({error:"UNAUTHORIZED"},{status:401});
 try{
  const {data:messages,error}=await client.rpc("aura_worker_read_confirmations",{p_visibility_timeout:300,p_qty:10});if(error)throw error;
  const items=Array.isArray(messages)?messages:[];let checked=0,confirmed=0,pending=0,failed=0;
  for(const item of items){
   const msgId=Number(item.msg_id);const withdrawalId=String(item.message?.withdrawal_id||"");
   if(!withdrawalId){await client.rpc("aura_worker_delete_confirmation_message",{p_msg_id:msgId});continue;}
   const {data:w,error:wError}=await client.from("wallet_withdrawals").select("*").eq("id",withdrawalId).maybeSingle();if(wError)throw wError;
   if(!w||w.status!=="broadcast"||!w.tx_hash){await client.rpc("aura_worker_delete_confirmation_message",{p_msg_id:msgId});continue;}
   const cfg=EVM[String(w.chain).toLowerCase() as keyof typeof EVM];if(!cfg){failed++;continue;}
   const rpcUrl=Deno.env.get(cfg.rpc);if(!rpcUrl){pending++;continue;}
   try{
    const receipt=await rpc(rpcUrl,"eth_getTransactionReceipt",[w.tx_hash]);if(!receipt){pending++;continue;}
    if(receipt.status!=="0x1"){await client.from("wallet_withdrawals").update({status:"failed",rejection_reason:"ONCHAIN_TRANSACTION_REVERTED",last_worker_error:"The broadcast transaction was mined but reverted.",updated_at:new Date().toISOString()}).eq("id",withdrawalId).eq("status","broadcast");await client.rpc("aura_worker_delete_confirmation_message",{p_msg_id:msgId});failed++;continue;}
    const latest=hexToBigInt(await rpc(rpcUrl,"eth_blockNumber",[]));const mined=hexToBigInt(receipt.blockNumber);const confirmations=latest>=mined?Number(latest-mined+1n):0;const required=Number(cfg.confirmations);
    const destination=String(w.destination_address).replace(/^0x/i,"").toLowerCase();
    const matchingTransfer=Array.isArray(receipt.logs)&&receipt.logs.some((log:any)=>String(log.address).toLowerCase()===cfg.token.toLowerCase()&&Array.isArray(log.topics)&&String(log.topics[0]).toLowerCase()===ERC20_TRANSFER_TOPIC&&String(log.topics[2]||"").toLowerCase().endsWith(destination));
    if(!matchingTransfer){await client.from("wallet_withdrawals").update({status:"failed",rejection_reason:"ONCHAIN_TRANSFER_NOT_MATCHED",last_worker_error:"Receipt succeeded but the expected USDT transfer event was not found.",updated_at:new Date().toISOString()}).eq("id",withdrawalId).eq("status","broadcast");await client.rpc("aura_worker_delete_confirmation_message",{p_msg_id:msgId});failed++;continue;}
    if(confirmations>=required){await client.from("wallet_withdrawals").update({status:"confirmed_onchain",confirmed_onchain_at:new Date().toISOString(),last_worker_error:null,updated_at:new Date().toISOString(),security_note:"On-chain USDT transfer confirmed with "+confirmations+" confirmations."}).eq("id",withdrawalId).eq("status","broadcast");await client.rpc("aura_worker_delete_confirmation_message",{p_msg_id:msgId});confirmed++;}else{pending++;}
    checked++;
   }catch(error){pending++;console.error("Indexer attempt failed",withdrawalId,String(error).slice(0,1000));}
  }
  return Response.json({ok:true,checked,confirmed,pending,failed});
 }catch(error){console.error("withdrawal-indexer failed",error);return Response.json({error:"INDEXER_ERROR"},{status:500});}
});