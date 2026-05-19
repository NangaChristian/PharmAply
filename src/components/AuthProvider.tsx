import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, onAuthStateChanged } from '../lib/firebase';
import { doc, getDoc } from '../lib/firebase';
import { auth, db, supabase } from '../lib/firebase';

interface AuthContextType {
  user: User | null;
  role: string | null;
  loading: boolean;
  refreshUser: () => void;
}

const AuthContext = createContext<AuthContextType>({ user: null, role: null, loading: true, refreshUser: () => {} });

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshToggle, setRefreshToggle] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            setRole(userDoc.data().role);
          } else {
            setRole(null);
          }
        } catch (error) {
          console.error("Error fetching user role", error);
          setRole(null);
        }
      } else {
        setRole(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const refreshUser = async () => {
    setRefreshToggle(prev => !prev);
    const { data } = await supabase.auth.getSession();
    if (data.session?.user) {
      const currentUser = {
        uid: data.session.user.id,
        email: data.session.user.email,
        emailVerified: data.session.user.email_confirmed_at != null,
        displayName: data.session.user.user_metadata?.displayName,
        photoURL: data.session.user.user_metadata?.photoURL,
      };
      auth.currentUser = currentUser;
      setUser(currentUser);
    }
  };

  return (
    <AuthContext.Provider value={{ user: auth.currentUser || user, role, loading, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
