import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (email: string, password: string, name: string) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);

  // Load user from localStorage on mount
  useEffect(() => {
    const storedUser = localStorage.getItem('unifyer_user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    // Simulate authentication - in production, this would be a real API call
    const storedUsers = JSON.parse(localStorage.getItem('unifyer_users') || '[]');
    const foundUser = storedUsers.find((u: any) => u.email === email && u.password === password);
    
    if (foundUser) {
      const userData: User = {
        id: foundUser.id,
        email: foundUser.email,
        name: foundUser.name
      };
      setUser(userData);
      localStorage.setItem('unifyer_user', JSON.stringify(userData));
      return true;
    }
    return false;
  };

  const signup = async (email: string, password: string, name: string): Promise<boolean> => {
    // Simulate user registration - in production, this would be a real API call
    const storedUsers = JSON.parse(localStorage.getItem('unifyer_users') || '[]');
    
    // Check if user already exists
    if (storedUsers.some((u: any) => u.email === email)) {
      return false;
    }

    const newUser = {
      id: Math.random().toString(36).substr(2, 9),
      email,
      password, // In production, never store plain passwords!
      name
    };

    storedUsers.push(newUser);
    localStorage.setItem('unifyer_users', JSON.stringify(storedUsers));

    // Auto-login after signup
    const userData: User = {
      id: newUser.id,
      email: newUser.email,
      name: newUser.name
    };
    setUser(userData);
    localStorage.setItem('unifyer_user', JSON.stringify(userData));
    return true;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('unifyer_user');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        signup,
        logout,
        isAuthenticated: !!user
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
