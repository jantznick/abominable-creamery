import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
// import { Button } from '../components/common/Button'; // REMOVE - Assuming Button component exists
// import { Input } from '../components/common/Input'; // REMOVE - Assuming Input component exists
import { FormInput } from '../components/ui/FormInput'; // CORRECTED Import

const ResetPassword = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [token, setToken] = useState<string | null>(null);
    const [email, setEmail] = useState<string | null>(null);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const tokenParam = searchParams.get('token');
        const emailParam = searchParams.get('email');

        if (!tokenParam || !emailParam) {
            setError('Missing or invalid password reset link parameters.');
            // Optional: Redirect to home or login if params are missing?
            // navigate('/');
        } else {
            setToken(tokenParam);
            setEmail(emailParam);
        }
    }, [searchParams, navigate]);

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError(null);
        setSuccess(null);

        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        if (!token || !email) {
             setError('Missing token or email. Cannot reset password.');
            return;
        }
        
        if (password.length < 6) {
             setError('Password must be at least 6 characters long.');
            return;
        }

        setLoading(true);

        try {
            const response = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ token, email, password }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to reset password.');
            }

            // On successful password reset, the backend logs the user in.
            // We might want to update AuthContext here if it exists and is used.
            // For now, just show success and redirect.
            setSuccess('Password reset successfully! Redirecting to profile...');

            // TODO: Update AuthContext if applicable
            // auth.login(data.user); // Example if login function exists

            setTimeout(() => {
                navigate('/profile');
            }, 2000); // Redirect after 2 seconds

        } catch (err: any) {
            console.error("Password Reset UI Error:", err);
            setError(err.message || 'An error occurred during password reset.');
        } finally {
            setLoading(false);
        }
    };

    if (!token || !email) {
        // Render error state if token/email are missing or invalid from the start
        return (
            <div className="container mx-auto px-4 py-8">
                <h1 className="text-2xl font-bold mb-4">Reset Password Error</h1>
                <p className="text-red-600">{error || 'Invalid password reset link.'}</p>
                {/* Maybe link to login or request reset again */}
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8 max-w-md">
            <h1 className="text-3xl font-bold text-center mb-6">Reset Your Password</h1>
            <form onSubmit={handleSubmit} className="space-y-4">
                 <div>
                    <FormInput
                        label="Email Address"
                        type="email"
                        id="email"
                        value={email || ''}
                        disabled
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-gray-100 cursor-not-allowed"
                        readOnly
                    />
                </div>
                <div>
                    <FormInput
                        label="New Password"
                        type="password"
                        id="password"
                        value={password}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                        required
                        minLength={6}
                        placeholder="Enter new password"
                    />
                </div>
                 <div>
                    <FormInput
                        label="Confirm New Password"
                        type="password"
                        id="confirmPassword"
                        value={confirmPassword}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)}
                        required
                         minLength={6}
                        placeholder="Confirm new password"
                    />
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}
                {success && <p className="text-sm text-green-600">{success}</p>}

                <div>
                    <button
                        type="submit"
                        disabled={loading || !!success}
                        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Resetting...' : 'Reset Password'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default ResetPassword; 