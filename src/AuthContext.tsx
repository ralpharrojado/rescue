import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
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
            const isAdmin = user.email?.toLowerCase() === "joseralpharrojado789@gmail.com" || 
                           user.email?.toLowerCase() === "joseralpharrojado909@gmail.com";
            
            console.log(`Auth: User ${user.email} is admin: ${isAdmin}, current role: ${data.role}`);

            // Auto-correct role if it's an admin email but not admin role
            if (isAdmin && data.role !== 'admin') {
              console.log(`Auth: Auto-updating ${user.email} to admin role`);
              setDoc(profileRef, { role: 'admin', isVerified: true }, { merge: true });
            }
            
            setProfile(data);
          } else {
            // If no profile exists yet, check if it's an admin email
            const isAdmin = user.email?.toLowerCase() === "joseralpharrojado789@gmail.com" || 
                           user.email?.toLowerCase() === "joseralpharrojado909@gmail.com";
            
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
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      if (error.code === 'auth/cancelled-popup-request' || error.code === 'auth/popup-closed-by-user') {
        // User closed the popup or a new one was opened, ignore
        return;
      }
      console.error("Sign in error:", error);
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
    if (role === 'mechanic' && (user.email === "joseralpharrojado789@gmail.com" || user.email === "joseralpharrojado909@gmail.com")) {
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
