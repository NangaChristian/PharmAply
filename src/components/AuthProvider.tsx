import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, onAuthStateChanged } from '../lib/firebase';
import { doc, getDoc } from '../lib/firebase';
import { auth, db, supabase } from '../lib/firebase';

interface AuthContextType {
  user: User | null;
  role: string | null;
  loading: boolean;
  refreshUser: () => void;
  impersonateUser: (user: User | null, role: string | null) => void;
  isImpersonating: boolean;
  stopImpersonating: () => void;
  actualUser: User | null;
  actualRole: string | null;
}

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  role: null, 
  loading: true, 
  refreshUser: () => {},
  impersonateUser: () => {},
  isImpersonating: false,
  stopImpersonating: () => {},
  actualUser: null,
  actualRole: null
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [actualUser, setActualUser] = useState<User | null>(null);
  const [actualRole, setActualRole] = useState<string | null>(null);
  
  const [impersonatedUser, setImpersonatedUser] = useState<User | null>(null);
  const [impersonatedRole, setImpersonatedRole] = useState<string | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [refreshToggle, setRefreshToggle] = useState(false);

  useEffect(() => {
    // Check local storage for impersonation data on mount
    try {
      const stored = localStorage.getItem('impersonation_state');
      if (stored) {
        const parsed = JSON.parse(stored);
        setImpersonatedUser(parsed.user);
        setImpersonatedRole(parsed.role);
      }
    } catch (e) {
      console.warn('Failed to parse impersonation state');
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setActualUser(currentUser);
      if (currentUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            setActualRole(userDoc.data().role);
          } else {
            setActualRole(null);
          }
        } catch (error) {
          console.error("Error fetching user role", error);
          setActualRole(null);
        }
      } else {
        setActualRole(null);
        // Clear impersonation if actual auth drops
        setImpersonatedUser(null);
        setImpersonatedRole(null);
        localStorage.removeItem('impersonation_state');
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
      // Note: we might not want to mutate auth.currentUser directly if impersonating
      // but it's okay for now.
      setActualUser(currentUser);
    }
  };

  const impersonateUser = (targetUser: User | null, targetRole: string | null) => {
    setImpersonatedUser(targetUser);
    setImpersonatedRole(targetRole);
    if (targetUser && targetRole) {
      localStorage.setItem('impersonation_state', JSON.stringify({ user: targetUser, role: targetRole }));
    } else {
      localStorage.removeItem('impersonation_state');
    }
  };

  const stopImpersonating = () => {
    impersonateUser(null, null);
  };

  const activeUser = impersonatedUser || actualUser;
  const activeRole = impersonatedUser ? impersonatedRole : actualRole;
  
  if (auth) {
     auth.currentUser = activeUser;
  }

  return (
    <AuthContext.Provider value={{ 
      user: activeUser, 
      role: activeRole, 
      loading, 
      refreshUser,
      impersonateUser,
      isImpersonating: !!impersonatedUser,
      stopImpersonating,
      actualUser,
      actualRole
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
