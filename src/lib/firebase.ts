import { initializeApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from "firebase/auth";
import { doc, getFirestore, serverTimestamp, setDoc } from "firebase/firestore";
const e = import.meta.env;
export const configured = Boolean(
  e.VITE_FIREBASE_API_KEY &&
  e.VITE_FIREBASE_AUTH_DOMAIN &&
  e.VITE_FIREBASE_PROJECT_ID &&
  e.VITE_FIREBASE_APP_ID,
);
const app = configured
  ? initializeApp({
      apiKey: e.VITE_FIREBASE_API_KEY,
      authDomain: e.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: e.VITE_FIREBASE_PROJECT_ID,
      appId: e.VITE_FIREBASE_APP_ID,
    })
  : null;
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
export async function googleLogin() {
  if (!auth) throw new Error("Configura Firebase para iniciar sesión.");
  await signInWithPopup(auth, new GoogleAuthProvider());
}
export async function emailLogin(
  email: string,
  password: string,
  name?: string,
) {
  if (!auth) throw new Error("Configura Firebase para iniciar sesión.");
  if (name) {
    const r = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(r.user, { displayName: name });
    if (db)
      await setDoc(doc(db, "users", r.user.uid), {
        name,
        avatar: null,
        updatedAt: serverTimestamp(),
      });
  } else await signInWithEmailAndPassword(auth, email, password);
}
export async function logout() {
  if (auth) await signOut(auth);
}
