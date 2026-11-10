// ===== CẤU HÌNH SUPABASE: dán 2 giá trị lấy ở Project Settings > API =====
const SB={url:'https://pnmfhvylcvhooweusrzg.supabase.co',key:'sb_publishable_JCklJbw_i5JPnmtJjRXC0g_Gep9xfnW'};
// =========================================================================
const sbh={apikey:SB.key,'Content-Type':'application/json'};
if(SB.key.startsWith('eyJ'))sbh.Authorization='Bearer '+SB.key;
const STORE={
 async pull(){const r=await fetch(SB.url+'/rest/v1/app_state?id=eq.1&select=data',{headers:sbh});if(!r.ok)throw new Error('Supabase '+r.status);const j=await r.json();return j[0]?j[0].data:null},
 async push(d){const r=await fetch(SB.url+'/rest/v1/app_state',{method:'POST',headers:{...sbh,Prefer:'resolution=merge-duplicates'},body:JSON.stringify({id:1,data:d,updated_at:new Date().toISOString()})});if(!r.ok)throw new Error('Supabase '+r.status+' '+await r.text())}
};
