import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
// Import the Firebase configuration
// We use a fallback pattern to support both local development (JSON) 
// and production environments (Environment Variables)
import firebaseConfigJson from '../firebase-applet-config.json';

// Fallback logic for environment variables (Vercel/Production)
const apiKey = import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfigJson.apiKey;
const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfigJson.authDomain;
const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseConfigJson.projectId;
const storageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfigJson.storageBucket;
const messagingSenderId = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfigJson.messagingSenderId;
const appId = import.meta.env.VITE_FIREBASE_APP_ID || firebaseConfigJson.appId;
const measurementId = import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || firebaseConfigJson.measurementId;
const firestoreDatabaseId = import.meta.env.VITE_FIREBASE_DATABASE_ID || firebaseConfigJson.firestoreDatabaseId;

const firebaseConfig = {
  apiKey,
  authDomain,
  projectId,
  storageBucket,
  messagingSenderId,
  appId,
  measurementId
};

// Initialize Firebase SDK
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firestoreDatabaseId);
export const auth = getAuth(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate Connection to Firestore
async function testConnection() {
  try {
    // Attempt to fetch a non-existent document to test connectivity
    await getDocFromServer(doc(db, '_internal_', 'connectivity_test'));
    console.log("Firebase connection established successfully.");
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Firebase configuration error: The client is offline. Please check your Firebase configuration.");
    } else if (error instanceof Error && error.message.includes('unavailable')) {
      console.error("Firebase connection error: The service is currently unavailable. This may be due to a temporary network issue or database provisioning.");
    } else {
      console.log("Firebase connectivity test completed (expected error if document doesn't exist).");
    }
  }
}

testConnection();

export default app;
