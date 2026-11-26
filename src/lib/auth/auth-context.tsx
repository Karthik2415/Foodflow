'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '@/lib/firebase/config';
import type { AppUser, UserRole } from '@/lib/types';

// ===== Demo Users (only used when .env.local Firebase keys are not configured) =====
const DEMO_USERS: Record<string, AppUser> = {
  'owner@foodflow.in': {
    id: 'user_owner',
    email: 'owner@foodflow.in',
    displayName: 'Rajesh Kumar',
    role: 'owner',
    phone: '+91 98765 43210',
    isActive: true,
    createdAt: null as any,
    updatedAt: null as any,
  },
  'admin@foodflow.in': {
    id: 'user_admin',
    email: 'admin@foodflow.in',
    displayName: 'Priya Sharma',
    role: 'admin',
    phone: '+91 98765 43211',
    isActive: true,
    createdAt: null as any,
    updatedAt: null as any,
  },
  'salesman@foodflow.in': {
    id: 'user_salesman_a',
    email: 'salesman@foodflow.in',
    displayName: 'Salesman A',
    role: 'salesman',
    phone: '+91 98765 43212',
    isActive: true,
    createdAt: null as any,
    updatedAt: null as any,
  },
  'production@foodflow.in': {
    id: 'user_production',
    email: 'production@foodflow.in',
    displayName: 'Murugan S',
    role: 'production_supervisor',
    phone: '+91 98765 43213',
    isActive: true,
    createdAt: null as any,
    updatedAt: null as any,
  },
  'accountant@foodflow.in': {
    id: 'user_accountant',
    email: 'accountant@foodflow.in',
    displayName: 'Lakshmi R',
    role: 'accountant',
    phone: '+91 98765 43214',
    isActive: true,
    createdAt: null as any,
    updatedAt: null as any,
  },
};

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  isLiveFirebase: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string, role: UserRole) => Promise<void>;
  switchRole: (role: UserRole) => Promise<void>;
  logout: () => Promise<void>;
  error: string | null;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isLiveFirebase: isFirebaseConfigured,
  login: async () => {},
  register: async () => {},
  switchRole: async () => {},
  logout: async () => {},
  error: null,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      const stored = localStorage.getItem('foodflow_user');
      if (stored) {
        try {
          setUser(JSON.parse(stored));
        } catch {}
      }
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        const tokenResult = await firebaseUser.getIdTokenResult();
        const claimRole = tokenResult.claims.role as UserRole | undefined;
        const userRef = doc(db, 'users', firebaseUser.uid);
        const snap = await getDoc(userRef);

        if (snap.exists()) {
          const data = snap.data() as Omit<AppUser, 'id'>;
          setUser({
            id: firebaseUser.uid,
            ...data,
            role: claimRole || data.role || 'owner',
          });
        } else {
          const newProfile: Omit<AppUser, 'id'> = {
            email: firebaseUser.email || '',
            displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
            role: claimRole || 'owner',
            isActive: true,
            createdAt: serverTimestamp() as any,
            updatedAt: serverTimestamp() as any,
          };
          await setDoc(userRef, newProfile);
          setUser({ id: firebaseUser.uid, ...newProfile });
        }
      } catch (err) {
        console.error('Failed to load Firebase user profile:', err);
        setUser({
          id: firebaseUser.uid,
          email: firebaseUser.email || '',
          displayName: firebaseUser.displayName || 'User',
          role: 'owner',
          isActive: true,
          createdAt: null as any,
          updatedAt: null as any,
        });
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    setLoading(true);
    try {
      if (!isFirebaseConfigured) {
        const demoUser = DEMO_USERS[email.toLowerCase()];
        if (demoUser) {
          setUser(demoUser);
          localStorage.setItem('foodflow_user', JSON.stringify(demoUser));
          return;
        }
        throw new Error('Invalid credentials. Use a demo account or configure Firebase in .env.local.');
      }

      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(async (email: string, password: string, displayName: string, role: UserRole) => {
    setError(null);
    setLoading(true);
    try {
      if (!isFirebaseConfigured) {
        const localUser: AppUser = {
          id: `user_${Date.now()}`,
          email,
          displayName,
          role,
          isActive: true,
          createdAt: null as any,
          updatedAt: null as any,
        };
        setUser(localUser);
        localStorage.setItem('foodflow_user', JSON.stringify(localUser));
        return;
      }

      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName });
      const userProfile: Omit<AppUser, 'id'> = {
        email,
        displayName,
        role,
        isActive: true,
        createdAt: serverTimestamp() as any,
        updatedAt: serverTimestamp() as any,
      };
      await setDoc(doc(db, 'users', cred.user.uid), userProfile);
      setUser({ id: cred.user.uid, ...userProfile });
    } catch (err: any) {
      setError(err.message || 'Registration failed');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const switchRole = useCallback(async (role: UserRole) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, role };
      if (!isFirebaseConfigured) {
        localStorage.setItem('foodflow_user', JSON.stringify(updated));
      }
      return updated;
    });
    if (isFirebaseConfigured && auth.currentUser) {
      try {
        await setDoc(
          doc(db, 'users', auth.currentUser.uid),
          { role, updatedAt: serverTimestamp() },
          { merge: true }
        );
      } catch (err) {
        console.error('Failed to persist role switch:', err);
      }
    }
  }, []);

  const logout = useCallback(async () => {
    if (!isFirebaseConfigured) {
      setUser(null);
      localStorage.removeItem('foodflow_user');
      return;
    }
    await signOut(auth);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, isLiveFirebase: isFirebaseConfigured, login, register, switchRole, logout, error }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export function useRequireAuth() {
  const { user, loading } = useAuth();
  return { user, loading, isAuthenticated: !!user };
}
