import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, onAuthStateChanged } from '../lib/firebase';
import { doc, getDoc } from '../lib/firebase';
import { auth, db, supabase } from '../lib/firebase';

interface AuthContextType {
  user: User | null;
  userData: any | null;
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
  userData: null,
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
  const [actualUserData, setActualUserData] = useState<any | null>(null);
  
  const [impersonatedUser, setImpersonatedUser] = useState<User | null>(null);
  const [impersonatedRole, setImpersonatedRole] = useState<string | null>(null);
  const [impersonatedUserData, setImpersonatedUserData] = useState<any | null>(null);
  
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
        setImpersonatedUserData(parsed.userData || null);
      }
    } catch (e) {
      console.warn('Failed to parse impersonation state');
    }

    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_OUT' || (event === 'TOKEN_REFRESHED' && !session)) {
          // Gracefully clear corrupt state and handle redirect
          setActualUser(null);
          setActualRole(null);
          setActualUserData(null);
          setImpersonatedUser(null);
          setImpersonatedRole(null);
          setImpersonatedUserData(null);
          localStorage.removeItem('impersonation_state');
          
          // Only redirect if we are not already on the login or onboarding pages
          if (window.location.pathname !== '/' && window.location.pathname !== '/admin-login') {
             window.location.href = '/';
          }
        }
      }
    );

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setActualUser(currentUser);
      if (currentUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            setActualRole(userDoc.data().role);
            setActualUserData(userDoc.data());
          } else {
            setActualRole(null);
            setActualUserData(null);
          }
        } catch (error) {
          console.error("Error fetching user role", error);
          setActualRole(null);
          setActualUserData(null);
        }
      } else {
        setActualRole(null);
        setActualUserData(null);
        // Clear impersonation if actual auth drops
        setImpersonatedUser(null);
        setImpersonatedRole(null);
        setImpersonatedUserData(null);
        localStorage.removeItem('impersonation_state');
      }
      setLoading(false);
    });

    return () => {
      unsubscribe();
      authSubscription.unsubscribe();
    };
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

  const impersonateUser = (targetUser: User | null, targetRole: string | null, targetUserData: any | null = null) => {
    setImpersonatedUser(targetUser);
    setImpersonatedRole(targetRole);
    setImpersonatedUserData(targetUserData);
    if (targetUser && targetRole) {
      localStorage.setItem('impersonation_state', JSON.stringify({ user: targetUser, role: targetRole, userData: targetUserData }));
    } else {
      localStorage.removeItem('impersonation_state');
    }
  };

  const stopImpersonating = () => {
    impersonateUser(null, null, null);
  };

  const activeUser = impersonatedUser || actualUser;
  const activeRole = impersonatedUser ? impersonatedRole : actualRole;
  const activeUserData = impersonatedUser ? impersonatedUserData : actualUserData;
  
  if (auth) {
     auth.currentUser = activeUser;
  }

  return (
    <AuthContext.Provider value={{ 
      user: activeUser, 
      userData: activeUserData,
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
