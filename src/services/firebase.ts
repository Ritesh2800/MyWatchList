import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseAppletConfig from '../../firebase-applet-config.json';

const customProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim();
const customDatabaseId = import.meta.env.VITE_FIREBASE_DATABASE_ID?.trim();

const USER_PROVIDED_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyBK3fz23TuMcdkQ6FdfwSLgaswtpzox4Ro',
  authDomain: 'gen-lang-client-0317199549.firebaseapp.com',
  projectId: 'gen-lang-client-0317199549',
  storageBucket: 'gen-lang-client-0317199549.firebasestorage.app',
  messagingSenderId: '825150389801',
  appId: '1:825150389801:web:6b2fbac3fa9226c1692638',
};

const firebaseConfig = {
  apiKey:
    import.meta.env.VITE_FIREBASE_API_KEY?.trim() ||
    USER_PROVIDED_FIREBASE_CONFIG.apiKey ||
    firebaseAppletConfig.apiKey,
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim() ||
    USER_PROVIDED_FIREBASE_CONFIG.authDomain ||
    firebaseAppletConfig.authDomain,
  projectId:
    customProjectId || USER_PROVIDED_FIREBASE_CONFIG.projectId || firebaseAppletConfig.projectId,
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET?.trim() ||
    USER_PROVIDED_FIREBASE_CONFIG.storageBucket ||
    firebaseAppletConfig.storageBucket,
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim() ||
    USER_PROVIDED_FIREBASE_CONFIG.messagingSenderId ||
    firebaseAppletConfig.messagingSenderId,
  appId:
    import.meta.env.VITE_FIREBASE_APP_ID?.trim() ||
    USER_PROVIDED_FIREBASE_CONFIG.appId ||
    firebaseAppletConfig.appId,
  firestoreDatabaseId:
    customDatabaseId ||
    (customProjectId && customProjectId !== firebaseAppletConfig.projectId
      ? '(default)'
      : firebaseAppletConfig.firestoreDatabaseId),
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId
);

export const app = initializeApp(firebaseConfig);
export const db =
  firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

void testConnection();
