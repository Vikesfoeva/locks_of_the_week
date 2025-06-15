import { createContext, useContext, useEffect, useState } from 'react'
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  // onLog // REMOVED direct import
} from 'firebase/auth'
import { initializeApp } from 'firebase/app'
import { API_URL } from '../config'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
}

console.log('[AuthContext] Initial firebaseConfig used for initializeApp:', firebaseConfig);

const app = initializeApp(firebaseConfig)
const auth = getAuth(app)
const googleProvider = new GoogleAuthProvider()

const AuthContext = createContext()

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');

  // Function to create user in MongoDB
  async function createUserInDb(user) {
    try {
      const { email, uid } = user;
      const response = await fetch(`${API_URL}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          firebaseUid: uid,
          // Other initial fields can be added here
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Could not create user in DB');
      }
      console.log('User created in DB:', data.message);
    } catch (error) {
      console.error('Error creating user in DB:', error);
      setAuthError(error.message);
    }
  }

  // Effect to handle auth state changes
  useEffect(() => {
    console.log('[AuthContext] Setting up onAuthStateChanged listener.');
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('[AuthContext] onAuthStateChanged triggered. User:', user ? user.uid : 'null');
      if (user) {
        try {
          const response = await fetch(`${API_URL}/users?firebaseUid=${user.uid}`);
          
          if (response.ok) {
            const userData = await response.json();
            setCurrentUser({ ...user, ...userData });
          } else if (response.status === 404) {
            console.log('User not found in DB, attempting to create.');
            await createUserInDb(user);
            const newUserResponse = await fetch(`${API_URL}/users?firebaseUid=${user.uid}`);
            if (newUserResponse.ok) {
              const newUserData = await newUserResponse.json();
              setCurrentUser({ ...user, ...newUserData });
            } else {
              setCurrentUser(user);
            }
          } else {
            console.error('Failed to fetch user data, setting Firebase user as fallback.');
            setCurrentUser(user);
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
          setCurrentUser(user); // Fallback to firebase user
        } finally {
          setLoading(false);
          console.log('[AuthContext] Auth state processed (user path). Loading set to false.');
        }
      } else {
        // User is signed out.
        setCurrentUser(null);
        setLoading(false);
        console.log('[AuthContext] Auth state processed (no user path). Loading set to false.');
      }
    });

    return () => {
      console.log('[AuthContext] Cleaning up onAuthStateChanged listener.');
      unsubscribe();
    };
  }, []);

  // Sign up with email and password
  async function signup(email, password) {
    setAuthError('');
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      console.log("[AuthContext] Firebase user created via email/pass:", userCredential.user.uid);
      await createUserInDb(userCredential.user); // Create user in your DB
      return userCredential;
    } catch (error) {
      console.error("[AuthContext] Error during email/pass signup:", error);
      setAuthError(error.message);
      throw error;
    }
  }

  // Sign in with email and password
  async function login(email, password) {
    setAuthError('');
    try {
      return await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error("[AuthContext] Error during email/pass login:", error);
      setAuthError(error.message);
      throw error;
    }
  }

  // Sign in with Google Popup
  async function loginWithGooglePopup() {
    setAuthError('');
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      console.log("[AuthContext] Google sign-in successful. User:", user.uid);
      // Check if user exists in your DB, if not, create them
      await createUserInDb(user);
      return result;
    } catch (error) {
      console.error("[AuthContext] Error during Google popup sign-in:", error);
      setAuthError(error.message);
      throw error;
    }
  }

  // Logout
  function logout() {
    setAuthError('');
    return signOut(auth);
  }

  // The value provided to the context consumers
  const value = {
    currentUser,
    loading,
    authError,
    setAuthError,
    signup,
    login,
    logout,
    loginWithGooglePopup,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}