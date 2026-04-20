import { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { UserProfile } from '@/types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  isDoctor: boolean;
  isNurse: boolean;
  isPharmacist: boolean;
  isLabTech: boolean;
  isReceptionist: boolean;
  isPatient: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const authUnsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      if (!firebaseUser) {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => authUnsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      const profileUnsubscribe = onSnapshot(
        doc(db, 'users', user.uid),
        (docSnap) => {
          if (docSnap.exists()) {
            setProfile(docSnap.data() as UserProfile);
          } else {
            setProfile(null);
          }
          setLoading(false);
        },
        (error) => {
          console.error("Error fetching user profile:", error);
          setProfile(null);
          setLoading(false);
        }
      );
      return () => profileUnsubscribe();
    } else {
      setLoading(false);
      setProfile(null);
    }
  }, [user]);

  const roles = useMemo(() => {
    const userRole = profile?.role;
    return {
      isAdmin: userRole === 'admin',
      isDoctor: userRole === 'doctor',
      isNurse: userRole === 'nurse',
      isPharmacist: userRole === 'pharmacist',
      isLabTech: userRole === 'lab_tech',
      isReceptionist: userRole === 'receptionist',
      isPatient: userRole === 'patient',
    };
  }, [profile]);

  const value = useMemo(() => ({
    user,
    profile,
    loading,
    ...roles,
  }), [user, profile, loading, roles]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
