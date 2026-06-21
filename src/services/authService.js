import { auth } from '../firebase/config';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';

// 1. Log in with Email and Password
export async function loginWithEmail(email, password) {
  if (!auth || !auth.app) {
    console.warn('Firebase Auth not initialized. Using local mock login.');
    if (email && password) return { email, uid: 'mock_uid_123' };
    throw new Error('Email and password required.');
  }

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    console.error('Error logging in with Firebase Auth:', error);
    throw error;
  }
}

// 2. Register / Sign up with Email and Password
export async function registerWithEmail(email, password) {
  if (!auth || !auth.app) {
    console.warn('Firebase Auth not initialized. Using local mock sign up.');
    if (email && password) return { email, uid: 'mock_uid_123' };
    throw new Error('Email and password required.');
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    console.error('Error registering with Firebase Auth:', error);
    throw error;
  }
}

// 3. Log out user
export async function logoutUser() {
  if (!auth || !auth.app) return;
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Error logging out from Firebase Auth:', error);
    throw error;
  }
}

// 4. Subscribe to Auth changes (onAuthStateChanged)
export function subscribeToAuth(onUserChange) {
  if (!auth || !auth.app) {
    console.warn('Firebase Auth not initialized. Offline auth subscription active.');
    return () => {}; // return empty unsubscribe
  }

  return onAuthStateChanged(auth, (user) => {
    onUserChange(user);
  });
}
