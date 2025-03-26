import React, { createContext, useContext, useState, useEffect } from 'react';
import axios, { AxiosError } from 'axios';
import toast from 'react-hot-toast';

interface User {
  id: string;
  email: string;
  fullName?: string;
}

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
}

interface AuthError {
  error: string;
  details?: any;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, name: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps): React.JSX.Element {
  const [authState, setAuthState] = useState<AuthState>(() => {
    const token = localStorage.getItem('token');
    const user = token ? JSON.parse(localStorage.getItem('user') || 'null') : null;
    return {
      isAuthenticated: Boolean(token),
      user,
      token
    };
  });

  useEffect(() => {
    if (authState.token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${authState.token}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }, [authState.token]);

  const login = async (email: string, password: string) => {
    try {
      const response = await axios.post(`${import.meta.env.VITE_API_URL}/auth/login`, {
        email,
        password,
      });
      const { token, user } = response.data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      setAuthState({ isAuthenticated: true, user, token });
      toast.success('Logged in successfully!');
      return true;
    } catch (error) {
      const axiosError = error as AxiosError<AuthError>;
      const errorMessage = axiosError.response?.data?.error || 'Login failed';
      console.error('Login error:', errorMessage);
      toast.error(errorMessage);
      return false;
    }
  };

  const register = async (email: string, password: string, name: string) => {
    try {
      console.log('Attempting registration with:', { email, name });
      const response = await axios.post(`${import.meta.env.VITE_API_URL}/auth/register`, {
        fullName: name,
        email,
        password,
      });
      const { token, user } = response.data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      setAuthState({ isAuthenticated: true, user, token });
      toast.success('Registration successful!');
      return true;
    } catch (error) {
      const axiosError = error as AxiosError<AuthError>;
      const errorMessage = axiosError.response?.data?.error || 'Registration failed';
      const details = axiosError.response?.data?.details;
      
      console.error('Registration error:', { error: errorMessage, details });
      
      if (details && typeof details === 'object') {
        Object.entries(details).forEach(([field, message]) => {
          if (message) toast.error(`${field}: ${message}`);
        });
      } else {
        toast.error(errorMessage);
      }
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setAuthState({ isAuthenticated: false, user: null, token: null });
    toast.success('Logged out successfully');
  };

  const contextValue: AuthContextType = {
    ...authState,
    login,
    register,
    logout,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 