import React, { useState, FormEvent, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext'; // Assuming context path

interface ForgotPasswordModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSwitchToLogin: () => void; // Optional: Link back to login
}

const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({ isOpen, onClose, onSwitchToLogin }) => {
    const [email, setEmail] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    // Reset state when modal opens/closes
    useEffect(() => {
        if (!isOpen) {
            setEmail('');
            setError(null);
            setSuccessMessage(null);
            setIsLoading(false);
        }
    }, [isOpen]);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccessMessage(null);
        setIsLoading(true);

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
             setError('Please enter a valid email address.');
             setIsLoading(false);
             return;
        }

        try {
            const response = await fetch('/api/auth/request-password-reset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });

            const data = await response.json();

            if (response.ok) {
                // Display the generic success message from the backend
                setSuccessMessage(data.message || 'Password reset request processed. Please check your console for the reset link (email sending not implemented yet).');
                // Optionally close modal after a delay or keep it open showing success
                // setTimeout(onClose, 5000); 
            } else {
                // Show error from backend, or a generic one
                setError(data.message || 'Failed to process request.');
            }
        } catch (err) {
            console.error('Request Password Reset error:', err);
            setError('An unexpected network error occurred. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSwitch = () => {
        onClose();
        onSwitchToLogin();
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
                    aria-label="Close forgot password modal"
                >
                    &times;
                </button>

                <h2 className="text-2xl font-bold mb-4 text-center">Forgot Your Password?</h2>
                <p className="text-gray-600 text-sm text-center mb-6">Enter your email address below, and we'll send you a link to reset your password (link will appear in server console for now).</p>

                <form onSubmit={handleSubmit}>
                    {error && <p className="text-red-500 text-sm mb-4 text-center">{error}</p>}
                    {successMessage && <p className="text-green-600 text-sm mb-4 text-center">{successMessage}</p>}

                    <div className="mb-4">
                        <label htmlFor="forgot-email" className="block text-gray-700 text-sm font-bold mb-2">
                            Email Address
                        </label>
                        <input
                            type="email"
                            id="forgot-email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                            required
                            disabled={isLoading || !!successMessage} // Disable if loading or success
                        />
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
                         <button
                            type="submit"
                            className={`w-full sm:w-auto bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline ${
                                (isLoading || !!successMessage) ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                            disabled={isLoading || !!successMessage}
                        >
                            {isLoading ? 'Sending...' : 'Send Reset Link'}
                        </button>
                         <button
                            type="button"
                            onClick={handleSwitch}
                            className="w-full sm:w-auto text-center sm:text-right inline-block align-baseline font-bold text-sm text-blue-500 hover:text-blue-800"
                            disabled={isLoading}
                        >
                            Back to Login
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ForgotPasswordModal; 