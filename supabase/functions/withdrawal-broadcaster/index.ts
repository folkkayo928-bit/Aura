import { createClient } from "npm:@supabase/supabase-js@2";
import { createPublicClient, createWalletClient, http, parseUnits, type Address } from "npm:viem@2";
import { privateKeyToAccount } from "npm:viem@2/accounts";
const ERC20_ABI = [{ type: "function", name: "transfer", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }] }] as const;
const CHAINS: Record<string, { id: number; name: string; token: Address; rpcEnv: string; native: string }> = {
 ethereum: { id: 1, name: "Ethereum", token: "0xdAC17F958D2ee523a2206206994597C13D831ec7" as Address, rpcEnv: "AURA_EVM_RPC_ETHEREUM", native: "ETH", tokenDecimals: 6 },
 polygon: { id: 137, name: "Polygon", token: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F" as Address, rpcEnv: "AURA_EVM_RPC_POLYGON", native: "POL", tokenDecimals: 6 },
 arbitrum: { id: 42161, name: "Arbitrum", token: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9" as Address, rpcEnv: "AURA_EVM_RPC_ARBITRUM", native: "ETH", tokenDecimals: 6 },
 bsc: { id: 56, name: "BNB Smart Chain", token: "0x55d398326f99059fF775485246999027B3197955" as Address, rpcEnv: "AURA_EVM_RPC_BSC", native: "BNB", tokenDecimals: 18 },
};
function secretKey(){ const raw=Deno.env.get("SUPABASE_SECRET_KEYS")||""; try{return JSON.parse(raw).default as string}catch{return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||""} }
function admin(){ return createClient(Deno.env.get("SUPABASE_URL")!, secretKey()); }
async function authorized(req: Request, client: ReturnType<typeof admin>){ const provided=req.headers.get("x-aura-worker-secret")||""; const {data,error}=await client.rpc("get_aura_worker_secret"); return !error && !!data && provided.length>0 && provided===data; }
async function notifyTelegramWithdrawal(client: ReturnType<typeof admin>, userId: string, title: string, message: string) {
  try {
    const { data: profile, error: profileError } = await client.from("profiles")
      .select("telegram_user_id").eq("id", userId).maybeSingle();
    if (profileError) throw profileError;
    const telegramUserId = String(profile?.telegram_user_id || "").trim();
    if (!/^\d{1,20}$/.test(telegramUserId)) return;
    const { data: secret, error: secretError } = await client.rpc("get_aura_telegram_notify_secret");
    if (secretError || !secret) return;
    const response = await fetch("https://aura-8bom.onrender.com/api/internal/telegram/withdrawal-notify", {
      method: "POST",
      headers: { "content-type": "application/json", "x-aura-telegram-notify-secret": String(secret) },
      body: JSON.stringify({ telegram_user_id: telegramUserId, title, message }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) console.warn("Telegram withdrawal status notification was not delivered", response.status);
  } catch (error) {
    console.warn("Telegram withdrawal status notification failed", String(error).slice(0, 500));
  }
}
function chainObject(c:any,rpc:string){ return {id:c.id,name:c.name,nativeCurrency:{name:c.native,symbol:c.native,decimals:18},rpcUrls:{default:{http:[rpc]},public:{http:[rpc]}}} as const; }
Deno.serve(async (req)=>{
 if(req.method!=="POST") return Response.json({error:"METHOD_NOT_ALLOWED"},{status:405});
 const db=admin(); if(!(await authorized(req,db))) return Response.json({error:"UNAUTHORIZED"},{status:401});
 try {
  const {data:messages,error:readError}=await db.rpc("aura_worker_read_withdrawals",{p_visibility_timeout:300,p_qty:5}); if(readError) throw readError;
  const items=Array.isArray(messages)?messages:[]; let processed=0,broadcast=0,deferred=0,rejected=0;
  for(const item of items){
   const msgId=Number(item.msg_id); const withdrawalId=String(item.message?.withdrawal_id||"");
   if(!withdrawalId){await db.rpc("aura_worker_delete_withdrawal_message",{p_msg_id:msgId});continue;}
   const {data:w,error:wError}=await db.from("wallet_withdrawals").select("*").eq("id",withdrawalId).maybeSingle(); if(wError) throw wError;
   if(!w||w.status!=="queued"){await db.rpc("aura_worker_delete_withdrawal_message",{p_msg_id:msgId});continue;}
   const cfg=CHAINS[String(w.chain).toLowerCase()];
   if(!cfg){ await db.from("wallet_withdrawals").update({status:"rejected",rejection_reason:"CHAIN_BROADCASTER_NOT_CONFIGURED",last_worker_error:"No secure broadcaster adapter is configured for this chain.",updated_at:new Date().toISOString()}).eq("id",withdrawalId).eq("status","queued"); await db.rpc("aura_worker_delete_withdrawal_message",{p_msg_id:msgId});
    await notifyTelegramWithdrawal(db, String(w.user_id), "Withdrawal could not be processed", "This withdrawal network is not currently configured for secure broadcasting. Please contact AURA support; your reserved funds require review.");
    rejected++;processed++;continue; }
   const rpcUrl=Deno.env.get(cfg.rpcEnv); const privateKey=Deno.env.get("AURA_EVM_PRIVATE_KEY");
   if(!rpcUrl||!privateKey){ await db.from("wallet_withdrawals").update({confirmation_attempts:Number(w.confirmation_attempts||0)+1,last_worker_error:"EVM broadcaster credentials are not configured; withdrawal remains queued.",next_attempt_at:new Date(Date.now()+300000).toISOString(),updated_at:new Date().toISOString()}).eq("id",withdrawalId).eq("status","queued"); deferred++;processed++;continue; }
   try {
    const chain=chainObject(cfg,rpcUrl); const account=privateKeyToAccount(privateKey as `0x${string}`);
    const publicClient=createPublicClient({chain,transport:http(rpcUrl)}); const walletClient=createWalletClient({account,chain,transport:http(rpcUrl)});
    const amount=parseUnits(String(w.amount),cfg.tokenDecimals);
    const {request}=await publicClient.simulateContract({account,address:cfg.token,abi:ERC20_ABI,functionName:"transfer",args:[String(w.destination_address) as Address,amount]});
    const txHash=await walletClient.writeContract(request);
    await db.from("wallet_withdrawals").update({status:"broadcast",tx_hash:txHash,broadcast_at:new Date().toISOString(),last_worker_error:null,next_attempt_at:null,updated_at:new Date().toISOString(),security_note:"Secure one-time confirmation token consumed; transaction broadcast through the configured server-side broadcaster."}).eq("id",withdrawalId).eq("status","queued");
    await db.rpc("aura_worker_enqueue_confirmation",{p_withdrawal_id:withdrawalId,p_delay_seconds:30}); await db.rpc("aura_worker_delete_withdrawal_message",{p_msg_id:msgId});
    await notifyTelegramWithdrawal(db, String(w.user_id), "Withdrawal broadcast", `${Number(w.amount).toFixed(6)} USDT is now broadcast on ${cfg.name}. Transaction: ${txHash}`);
    broadcast++;processed++;
   } catch(error){ const message=String(error instanceof Error?error.message:error).slice(0,1500); await db.from("wallet_withdrawals").update({confirmation_attempts:Number(w.confirmation_attempts||0)+1,last_worker_error:message,next_attempt_at:new Date(Date.now()+300000).toISOString(),updated_at:new Date().toISOString()}).eq("id",withdrawalId).eq("status","queued"); deferred++;processed++; console.error("Broadcast attempt failed",withdrawalId,message); }
  }
  return Response.json({ok:true,processed,broadcast,deferred,rejected});
 } catch(error){ console.error("withdrawal-broadcaster failed",error); return Response.json({error:"WORKER_ERROR"},{status:500}); }
});