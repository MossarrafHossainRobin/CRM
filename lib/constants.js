export const STAGES=['New','Contacted','Interested','Paid','Lost'];
export const TYPES=['Sales','Support','Spam','Job','Other'];
export const INTERESTS=['Bootcamp','Fellowship','Corporate Training','Unknown'];
export const CHANNELS=['WhatsApp','Facebook Messenger','Facebook comment','Website form','Phone call note','Other'];
export function cleanLead(x){
 const status=STAGES.includes(x.status)?x.status:'New';
 const type=TYPES.includes(x.type)?x.type:'Other';
 const interest=INTERESTS.includes(x.interest)?x.interest:'Unknown';
 return {name:String(x.name||'').slice(0,150),phone:String(x.phone||'').slice(0,50),source:CHANNELS.includes(x.source)?x.source:'Other',message:String(x.message||'').slice(0,6000),status,type,interest,language:['Bangla','Banglish','English'].includes(x.language)?x.language:'English',reply:String(x.reply||'').slice(0,3000),notes:String(x.notes||'').slice(0,3000),receivedAt:String(x.receivedAt||'').slice(0,40),lastContactedAt:String(x.lastContactedAt||'').slice(0,40),followUpAt:String(x.followUpAt||'').slice(0,40),sampleId:String(x.sampleId||'').slice(0,30)};
}
