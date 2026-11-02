import admin from 'firebase-admin';
export function db(){
 if(!admin.apps.length){
  const projectId=process.env.FIREBASE_PROJECT_ID;
  const clientEmail=process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey=process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n');
  if(!projectId||!clientEmail||!privateKey) throw new Error('Firebase environment variables missing');
  admin.initializeApp({credential:admin.credential.cert({projectId,clientEmail,privateKey})});
 }
 return admin.firestore();
}
