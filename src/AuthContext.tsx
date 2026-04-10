import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider, 
  signOut, 
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  onSnapshot,
  serverTimestamp 
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './firebase';

export type UserRole = 'customer' | 'mechanic' | 'admin';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: UserRole;
  isOnline?: boolean;
  location?: { lat: number; lng: number };
  skills?: string[];
  isVerified?: boolean;
  application?: {
    fullName: string;
    birthday: string;
    idCardUrl: string;
    facePhotoUrl: string;
    submittedAt: any;
    status: 'pending' | 'approved' | 'rejected';
  };
  lastRequestAt?: any;
  createdAt: any;
}

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: () => Promise<void>;
  logout: () => Promise<void>;
  updateRole: (role: UserRole) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubProfile: (() => void) | null = null;

    // Handle redirect result for mobile sign-in
    getRedirectResult(auth).catch((error) => {
      console.error("Redirect sign-in error:", error);
      if (error.code === 'auth/unauthorized-domain') {
        alert("This domain is not authorized in Firebase. Please add your Vercel URL to 'Authorized Domains' in the Firebase Console.");
      }
    });

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      
      // Clean up previous profile listener if it exists
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }

      if (user) {
        const path = `users/${user.uid}`;
        const profileRef = doc(db, 'users', user.uid);
        
        unsubProfile = onSnapshot(profileRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data() as UserProfile;
            const isAdmin = user.email?.toLowerCase() === "joseralpharrojado789@gmail.com";
            
            console.log(`Auth: User ${user.email} is admin: ${isAdmin}, current role: ${data.role}`);

            // Auto-correct role if it's an admin email but not admin role
            if (isAdmin && data.role !== 'admin') {
              console.log(`Auth: Auto-updating ${user.email} to admin role`);
              setDoc(profileRef, { role: 'admin', isVerified: true }, { merge: true });
            }
            
            setProfile(data);
          } else {
            // If no profile exists yet, check if it's an admin email
            const isAdmin = user.email?.toLowerCase() === "joseralpharrojado789@gmail.com";
            
            if (isAdmin) {
              console.log(`Auth: Creating new admin profile for ${user.email}`);
              const adminProfile: UserProfile = {
                uid: user.uid,
                email: user.email!,
                displayName: user.displayName || 'Admin',
                photoURL: user.photoURL || '',
                role: 'admin',
                isVerified: true,
                createdAt: serverTimestamp(),
              };
              setDoc(profileRef, adminProfile);
              setProfile(adminProfile);
            } else {
              setProfile(null);
            }
          }
          setLoading(false);
        }, (error) => {
          // Only handle as error if it's not a cancellation
          if (error.code !== 'cancelled') {
            handleFirestoreError(error, OperationType.GET, path);
          }
          setLoading(false);
        });
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (unsubProfile) unsubProfile();
    };
  }, []);

  const signIn = async () => {
    const provider = new GoogleAuthProvider();
    
    // Check if user is on Safari
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    const isIframe = window.self !== window.top;

    try {
      // Always prefer popup in this environment, especially in iframes
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      if (error.code === 'auth/cancelled-popup-request' || error.code === 'auth/popup-closed-by-user') {
        return;
      }
      
      console.error("Sign in error:", error);
      
      // If popup fails and we are in an iframe on Safari, it's likely ITP
      if (isSafari && isIframe) {
        alert("Safari's security settings may be blocking the login in this preview. If the login fails, please try opening the app in a new tab using the button in the top right.");
      }

      // Fallback to redirect only if popup is blocked or fails for other reasons
      if (error.code === 'auth/popup-blocked') {
        try {
          await signInWithRedirect(auth, provider);
        } catch (redirectError) {
          console.error("Redirect fallback error:", redirectError);
        }
      } else {
        // Provide user-friendly error messages
        let message = "Failed to sign in. Please try again.";
        if (error.code === 'auth/unauthorized-domain') {
          message = "This domain is not authorized in Firebase. Please add your Vercel URL to 'Authorized Domains' in the Firebase Console.";
        }
        alert(message);
      }
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const updateRole = async (role: UserRole) => {
    if (!user) return;
    const path = `users/${user.uid}`;
    const profileRef = doc(db, 'users', user.uid);
    const updateData: any = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      role,
      createdAt: serverTimestamp(),
      isOnline: role === 'mechanic' ? true : false,
    };

    // Auto-verify admin for testing
    if (role === 'mechanic' && user.email === "joseralpharrojado789@gmail.com") {
      updateData.isVerified = true;
    }

    try {
      await setDoc(profileRef, updateData, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, logout, updateRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
