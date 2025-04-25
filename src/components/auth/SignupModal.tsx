import React, { useState, FormEvent, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext'; // Adjusted path

interface SignupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToLogin: () => void; // Function to open the login modal
}

const SignupModal: React.FC<SignupModalProps> = ({ isOpen, onClose, onSwitchToLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();

  // Reset form state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setName('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setError(null);
      setIsLoading(false);
    }
  }, [isOpen]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password || !confirmPassword) {
      setError('Email, password, and confirmation are required.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    setIsLoading(true);

    try {
      console.log('Attempting signup via modal with:', email, name);
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      });

      const data = await response.json();

      if (response.ok) {
        login(data.user); // Automatically log in the user after successful signup
        onClose(); // Close the modal
      } else {
        setError(data.message || 'Signup failed. Please try again.');
      }
    } catch (err) {
      console.error('Signup error:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSwitch = () => {
      onClose(); // Close this modal
      onSwitchToLogin(); // Open the other one
  }

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-center items-center p-4">
      <div className="bg-white p-6 md:p-8 rounded-lg shadow-xl z-50 w-full max-w-md relative">
        <button
            onClick={onClose}
            className="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-2xl font-bold"
            aria-label="Close sign up modal"
        >
            &times;
        </button>

        <h2 className="text-2xl font-bold mb-6 text-center">Sign Up</h2>

        <form onSubmit={handleSubmit}>
          {error && <p className="text-red-500 text-sm mb-4 text-center">{error}</p>}
          <div className="mb-4">
            <label htmlFor="signup-name" className="block text-gray-700 text-sm font-bold mb-2">
              Name (Optional)
            </label>
            <input
              type="text"
              id="signup-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              disabled={isLoading}
            />
          </div>
          <div className="mb-4">
            <label htmlFor="signup-email" className="block text-gray-700 text-sm font-bold mb-2">
              Email Address
            </label>
            <input
              type="email"
              id="signup-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              required
              disabled={isLoading}
            />
          </div>
          <div className="mb-4">
            <label htmlFor="signup-password" className="block text-gray-700 text-sm font-bold mb-2">
              Password (min. 6 characters)
            </label>
            <input
              type="password"
              id="signup-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              required
              disabled={isLoading}
            />
          </div>
          <div className="mb-6">
            <label htmlFor="signup-confirmPassword" className="block text-gray-700 text-sm font-bold mb-2">
              Confirm Password
            </label>
            <input
              type="password"
              id="signup-confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline"
              required
              disabled={isLoading}
            />
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <button
              type="submit"
              className={`w-full sm:w-auto bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline ${
                isLoading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              disabled={isLoading}
            >
              {isLoading ? 'Signing Up...' : 'Sign Up'}
            </button>
            <button
                type="button"
                onClick={handleSwitch}
                className="w-full sm:w-auto text-center sm:text-right inline-block align-baseline font-bold text-sm text-blue-500 hover:text-blue-800"
            >
              Already have an account? Login
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SignupModal; 