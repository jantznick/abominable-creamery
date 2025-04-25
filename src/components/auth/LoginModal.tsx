import React, { useState, FormEvent, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext'; // Adjusted path

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToSignup: () => void; // Function to open the signup modal
  onSwitchToForgotPassword: () => void; // ADDED: Function to open forgot password modal
}

const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onSwitchToSignup, onSwitchToForgotPassword }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();

  // Reset form state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setEmail('');
      setPassword('');
      setError(null);
      setIsLoading(false);
    }
  }, [isOpen]);


  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError('Email and password are required.');
      return;
    }

    setIsLoading(true);

    try {
      console.log('Attempting login via modal with:', email);
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        login(data.user); 
        onClose(); 
      } else {
        setError(data.message || 'Login failed. Check email and password.');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSwitchToSignup = () => {
    onClose();
    onSwitchToSignup();
  }

  const handleSwitchToForgotPassword = () => {
    onClose();
    onSwitchToForgotPassword();
  }

  if (!isOpen) {
    return null; // Don't render anything if the modal is closed
  }

  return (
    // Modal backdrop
    <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-center items-center p-4">
      {/* Modal container */}
      <div className="bg-white p-6 md:p-8 rounded-lg shadow-xl z-50 w-full max-w-md relative">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-2xl font-bold"
          aria-label="Close login modal"
        >
          &times; {/* HTML entity for 'X' */}
        </button>

        <h2 className="text-2xl font-bold mb-6 text-center">Login</h2>

        <form onSubmit={handleSubmit}>
          {error && <p className="text-red-500 text-sm mb-4 text-center">{error}</p>}
          <div className="mb-4">
            <label htmlFor="login-email" className="block text-gray-700 text-sm font-bold mb-2">
              Email Address
            </label>
            <input
              type="email"
              id="login-email" // Use unique ID for accessibility
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              required
              disabled={isLoading}
            />
          </div>
          <div className="mb-4">
             <div className="flex justify-between items-baseline mb-2">
                <label htmlFor="login-password" className="block text-gray-700 text-sm font-bold">
                    Password
                </label>
                 <button
                    type="button"
                    onClick={handleSwitchToForgotPassword}
                    className="inline-block align-baseline font-bold text-sm text-blue-500 hover:text-blue-800"
                    disabled={isLoading}
                >
                    Forgot Password?
                </button>
            </div>
            <input
              type="password"
              id="login-password" // Use unique ID for accessibility
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              required
              disabled={isLoading}
            />
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
            <button
              type="submit"
              className={`w-full sm:w-auto bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline ${
                isLoading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              disabled={isLoading}
            >
              {isLoading ? 'Logging In...' : 'Login'}
            </button>
            <button
                type="button" // Important: Prevent form submission
                onClick={handleSwitchToSignup}
                className="w-full sm:w-auto text-center sm:text-right inline-block align-baseline font-bold text-sm text-green-500 hover:text-green-800"
            >
              Need an account? Sign Up
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginModal; 