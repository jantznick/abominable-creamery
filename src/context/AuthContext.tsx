import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';

// Define the shape of the user object (adjust based on your actual user data)
interface User {
  id: number;
  email: string;
  name?: string | null;
  role: 'USER' | 'ADMIN';
  phone?: string | null;
  // Add other relevant user fields
}

// Define the shape of the context value
interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (userData: User) => void; // Placeholder, implement actual login logic later
  logout: () => Promise<void>; // Changed logout to return promise
  checkAuthStatus: () => Promise<void>; // Function to check session on load

  // Modal State and Controls
  isLoginOpen: boolean;
  isSignupOpen: boolean;
  isForgotPasswordOpen: boolean;
  openLogin: () => void;
  closeLogin: () => void;
  openSignup: () => void;
  closeSignup: () => void;
  openForgotPassword: () => void;
  closeForgotPassword: () => void;
  switchToLogin: () => void;
  switchToSignup: () => void;
  switchToForgotPassword: () => void;
}

// Create the context with a default value (or null/undefined if preferred)
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Define the props for the AuthProvider
interface AuthProviderProps {
  children: ReactNode;
}

// Create the provider component
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Start loading until auth check is done
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isSignupOpen, setIsSignupOpen] = useState(false);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);

  // --- Modal Control Functions ---
  const openLogin = () => {
    closeSignup();
    closeForgotPassword();
    setIsLoginOpen(true);
  };
  const closeLogin = () => setIsLoginOpen(false);

  const openSignup = () => {
    closeLogin();
    closeForgotPassword();
    setIsSignupOpen(true);
  };
  const closeSignup = () => setIsSignupOpen(false);

  const openForgotPassword = () => {
    closeLogin();
    closeSignup();
    setIsForgotPasswordOpen(true);
  };
  const closeForgotPassword = () => setIsForgotPasswordOpen(false);

  const switchToSignup = () => {
    closeLogin();
    setTimeout(() => openSignup(), 150);
  };

  const switchToLogin = () => {
    closeSignup();
    closeForgotPassword();
    setTimeout(() => openLogin(), 150);
  };

  const switchToForgotPassword = () => {
    closeLogin();
    setTimeout(() => openForgotPassword(), 150);
  };
  // --- End Modal Control Functions ---


  // Function to check authentication status (e.g., by calling /api/auth/me)
  const checkAuthStatus = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else {
        setUser(null); // Not authenticated or error
      }
    } catch (error) {
      console.error('Failed to fetch auth status:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Check auth status when the component mounts
  useEffect(() => {
    checkAuthStatus();
  }, []);

  // Placeholder login function (called by LoginModal/SignupModal on success)
  const login = (userData: User) => {
    setUser(userData);
    // Close modals after successful login/signup automatically
    closeLogin();
    closeSignup();
  };

  // Updated logout function
  const logout = async () => {
    console.log("AuthContext: Logging out...");
    try {
      // Call the backend logout endpoint
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (!response.ok) {
          // Handle logout API error (optional: show message to user)
          const errorData = await response.json().catch(() => ({})); // Try to get error message
          console.error('API Logout failed:', response.status, errorData.message);
          // Decide if we should still clear the user state locally
      }
      setUser(null); // Clear user state locally regardless of minor API hiccup
      console.log("AuthContext: Logout completed, user state cleared.");
    } catch (error) {
      console.error('Logout fetch failed:', error);
      setUser(null); // Still clear user state locally on network error
    }
  };

  const value: AuthContextType = {
    user,
    isLoading,
    login,
    logout,
    checkAuthStatus,
    // Pass modal state and functions through context
    isLoginOpen,
    isSignupOpen,
    isForgotPasswordOpen,
    openLogin,
    closeLogin,
    openSignup,
    closeSignup,
    openForgotPassword,
    closeForgotPassword,
    switchToLogin,
    switchToSignup,
    switchToForgotPassword,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use the AuthContext
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 