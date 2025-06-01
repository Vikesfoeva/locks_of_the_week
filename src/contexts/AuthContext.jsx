import { createContext, useContext, useState, useEffect } from 'react'
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

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
}

console.log('[AuthContext] Initial firebaseConfig used for initializeApp:', firebaseConfig);

const app = initializeApp(firebaseConfig)
const auth = getAuth(app)

console.log('[AuthContext] Initial auth object created:', auth);

const googleProvider = new GoogleAuthProvider()

const AuthContext = createContext()

const API_URL = 'http://localhost:5001/api'

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true) // Start true
  const [authError, setAuthError] = useState('')

  function signup(email, password) {
    return createUserWithEmailAndPassword(auth, email, password)
  }

  function login(email, password) {
    setAuthError('')
    return signInWithEmailAndPassword(auth, email, password)
  }

  async function loginWithGoogle() {
    setAuthError('')
    setLoading(true); // Set loading true before initiating redirect
    try {
      console.log('hi')
      console.log(auth)
      console.log(googleProvider)
      await signInWithRedirect(auth, googleProvider);
      console.log('hi')
      // signInWithRedirect doesn't resolve with a user object directly here,
      // the redirect result is handled by getRedirectResult and onAuthStateChanged.
      // setLoading(false) will be handled by onAuthStateChanged or getRedirectResult logic.
    } catch (error) {
      setAuthError(error.message || 'Failed to initiate Google sign-in');
      console.error("[AuthContext] Error initiating Google sign-in:", error);
      setLoading(false); // Set loading false if redirect initiation fails
      // throw error // Optional: re-throw if Login page handles it
    }
  }

  async function loginWithGooglePopup() {
    setAuthError('');
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      // User is signed in. onAuthStateChanged will handle setting currentUser.
      // You can access the result.user here if needed for immediate post-popup actions,
      // but typically onAuthStateChanged is the central place to manage user state.
      console.log("[AuthContext] Google sign-in with popup successful:", result.user.email);
      // setLoading(false) will be handled by onAuthStateChanged's logic
    } catch (error) {
      setAuthError(error.message || 'Failed to sign in with Google popup');
      console.error("[AuthContext] Error with Google sign-in popup:", error);
      setLoading(false); // Set loading false if popup fails
    }
  }

  function logout() {
    setAuthError('')
    return signOut(auth)
  }

  // Call getRedirectResult once on component mount - REMOVED PROACTIVE CALL
  // useEffect(() => {
  //   console.log('[AuthContext] AuthProvider mounted. Calling getRedirectResult proactively.');
  //   setLoading(true); // Explicitly set loading true here
  //   getRedirectResult(auth)
  //     .then((result) => {
  //       console.log('[AuthContext] Proactive getRedirectResult.then() - Result:', result);
  //       if (result && result.user) {
  //         // If a user is found, onAuthStateChanged will handle them.
  //         // No need to setCurrentUser here directly, as onAuthStateChanged will fire.
  //         console.log('[AuthContext] User found by proactive getRedirectResult:', result.user.email);
  //       }
  //       // If no user from redirect, onAuthStateChanged will handle the null user state.
  //     })
  //     .catch((error) => {
  //       console.error("[AuthContext] Error from proactive getRedirectResult: ", error);
  //       setAuthError(error.message || 'Failed to process sign-in after redirect');
  //       setCurrentUser(null);
  //       setLoading(false); // Set loading false on error
  //     })
  //     .finally(() => {
  //       // setLoading(false) here might be too early if onAuthStateChanged still needs to run.
  //       // The onAuthStateChanged listener will manage the final loading state.
  //       console.log('[AuthContext] Proactive getRedirectResult.finally()');
  //     });
  // }, []); // Empty dependency array ensures this runs only once on mount

  useEffect(() => {
    console.log('[AuthContext] useEffect for onAuthStateChanged mounting. Initializing loading to true.');
    setLoading(true); // Ensure loading is true at the start of this effect.

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('[AuthContext] onAuthStateChanged triggered. User from onAuthStateChanged:', user);

      if (user) {
        console.log('[AuthContext] User object received directly in onAuthStateChanged:', user.email);
        // SIMPLIFIED: For now, just set the user. Whitelist/DB logic will be added back later.
        // TODO: Add back whitelist and DB logic here once getRedirectResult is confirmed working.
        setCurrentUser(user);
        console.log('[AuthContext] setCurrentUser called with user from onAuthStateChanged:', user.email);
        setLoading(false);
        console.log('[AuthContext] Finished processing direct user in onAuthStateChanged. Loading set to false.');
      } else {
        console.log('[AuthContext] No user from onAuthStateChanged. Attempting getRedirectResult...');
        getRedirectResult(auth)
          .then((result) => {
            console.log('[AuthContext] getRedirectResult.then() inside onAuthStateChanged - Result:', result);
            if (result && result.user) {
              const redirectedUser = result.user;
              console.log('[AuthContext] User found by getRedirectResult:', redirectedUser.email);
              // SIMPLIFIED: For now, just set the user. Whitelist/DB logic will be added back later.
              // TODO: Add back whitelist and DB logic here.
              setCurrentUser(redirectedUser);
              console.log('[AuthContext] setCurrentUser called with user from getRedirectResult:', redirectedUser.email);
            } else {
              console.log('[AuthContext] No user from getRedirectResult. User remains null.');
              setCurrentUser(null); // Ensure user is null if no redirect result
            }
          })
          .catch((error) => {
            console.error("[AuthContext] Error from getRedirectResult in onAuthStateChanged: ", error);
            setAuthError(error.message || 'Failed to process sign-in after redirect');
            setCurrentUser(null);
          })
          .finally(() => {
            console.log('[AuthContext] getRedirectResult.finally() in onAuthStateChanged. Setting loading to false.');
            setLoading(false);
          });
      }
    }); // Removed dependency array, or use [] if no dependencies from AuthProvider scope are needed inside. For safety, use [auth] if auth can change, but it shouldn't here.
       // Let's use [] for now as auth is module-level.

    return unsubscribe;
  }, []); // Empty dependency array: runs once on mount and cleans up on unmount.

  const value = {
    currentUser,
    signup,
    login,
    loginWithGoogle,
    loginWithGooglePopup,
    logout,
    authError,
    setAuthError
  }

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  )
} 