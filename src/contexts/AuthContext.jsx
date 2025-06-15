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
      throw error;
    }
  }

  // Effect to handle auth state changes
  useEffect(() => {
    console.log('[AuthContext] Setting up onAuthStateChanged listener.');
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoading(true); // Set loading at the beginning
      console.log('[AuthContext] onAuthStateChanged triggered. User:', user ? user.uid : 'null');
      if (user) {
        try {
          // 1. Check if user is in our DB
          const response = await fetch(`${API_URL}/users?firebaseUid=${user.uid}`);
          
          if (response.ok) {
            const userData = await response.json();
            setCurrentUser({ ...user, ...userData });
          } else if (response.status === 404) {
            console.log('User not found in DB, checking whitelist before creation.');
            
            // 2. If not in DB, check if they are whitelisted
            const whitelistCheckResponse = await fetch(`${API_URL}/whitelist/check?email=${user.email}`);
            const whitelistCheckData = await whitelistCheckResponse.json();

            if (whitelistCheckResponse.ok && whitelistCheckData.allowed) {
              console.log('User is whitelisted. Creating user in DB.');
              // 3. If whitelisted, create user
              await createUserInDb(user);
              const newUserResponse = await fetch(`${API_URL}/users?firebaseUid=${user.uid}`);
              if (newUserResponse.ok) {
                const newUserData = await newUserResponse.json();
                setCurrentUser({ ...user, ...newUserData });
              } else {
                 // This case is unlikely but handled for safety
                throw new Error('Failed to fetch user data after creation.');
              }
            } else {
              // 4. If not whitelisted, sign out and set error
              console.log('User is not whitelisted. Signing out.');
              setAuthError('Your email is not authorized to use this application.');
              await signOut(auth); // This will re-trigger onAuthStateChanged with user=null
              setCurrentUser(null);
            }
          } else {
            // Handle other non-404 errors
            throw new Error(`Failed to fetch user data (status: ${response.status})`);
          }
        } catch (error) {
          console.error('Error during auth state processing:', error);
          setAuthError(error.message || 'An error occurred during authentication.');
          setCurrentUser(user); // Fallback to firebase user to avoid logging out on transient backend errors
        } finally {
          setLoading(false);
          console.log('[AuthContext] Auth state processed. Loading set to false.');
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
      console.log("[AuthContext] Google sign-in successful. Checking whitelist for user:", user.email);

      // 1. Check if the user is whitelisted
      const whitelistCheckResponse = await fetch(`${API_URL}/whitelist/check?email=${user.email}`);
      const whitelistCheckData = await whitelistCheckResponse.json();
      
      if (!whitelistCheckResponse.ok || !whitelistCheckData.allowed) {
        console.error("Whitelist check failed or user not allowed.");
        // Sign the user out from Firebase as they are not authorized in our system
        await signOut(auth);
        const errorMessage = whitelistCheckData.error || 'This email is not authorized for account creation. Please contact an administrator.';
        setAuthError(errorMessage);
        throw new Error(errorMessage);
      }

      // 2. Check if user exists in your DB, if not, the onAuthStateChanged will handle creation
      // This logic can be simplified as onAuthStateChanged will run anyway.
      // We just need to ensure the user is logged in here. The effect will handle the DB check/creation.
      console.log("[AuthContext] User is whitelisted. Auth state change will handle DB sync.");

      return result;
    } catch (error) {
      console.error("[AuthContext] Error during Google popup sign-in:", error);
      // Ensure authError is set from caught errors.
      if (!authError) {
        setAuthError(error.message);
      }
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