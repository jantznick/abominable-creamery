import React, { useState, FormEvent, useEffect } from 'react';
import UserProfileForm, { UserProfileFormData } from './UserProfileForm';
import { useAuth } from '../../context/AuthContext'; // Need access to update user state
import { ApiUser } from '../../types/data'; // Use the shared user type

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void; 
  currentUser: ApiUser; // Pass the current user data
}

const UserProfileModal: React.FC<UserProfileModalProps> = ({ isOpen, onClose, currentUser }) => {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth(); // Get login function to update context

  // Reset error when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setError(null); 
    }
  }, [isOpen]);

  const handleFormSubmit = async (formData: UserProfileFormData) => {
    setIsLoading(true);
    setError(null);
    
    // Only send fields that have actually changed
    const changedData: Partial<UserProfileFormData> = {};
    if (formData.name !== currentUser.name) {
        changedData.name = formData.name;
    }
    if (formData.email !== currentUser.email) {
        changedData.email = formData.email;
    }
    if (formData.phone !== currentUser.phone) {
        changedData.phone = formData.phone;
    }

    // If nothing changed, just close the modal
    if (Object.keys(changedData).length === 0) {
        setIsLoading(false);
        onClose();
        return;
    }

    try {
      const response = await fetch('/api/users/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changedData),
      });

      const data = await response.json();

      if (response.ok) {
        // Update AuthContext with the new user data from the API response
        login(data.user); 
        onClose(); // Close modal on success
      } else {
        setError(data.message || 'Failed to update profile.');
      }
    } catch (err) {
      console.error('Profile Update Submit error:', err);
      setError('An unexpected network error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    // Modal backdrop (Similar structure to AddressModal/LoginModal)
    <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-center items-center p-4 transition-opacity duration-300 ease-in-out">
      {/* Modal container */} 
      <div className="bg-white p-6 md:p-8 rounded-lg shadow-xl z-50 w-full max-w-md relative transform transition-all duration-300 ease-in-out scale-95 opacity-0 animate-modal-enter">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-2 right-3 text-gray-400 hover:text-gray-600 text-2xl font-light"
          aria-label="Close profile edit form"
        >
          &times;
        </button>

        <h2 className="text-xl font-semibold mb-5 text-gray-800">
          Edit Profile
        </h2>

        {/* Display submit errors here */}
        {error && <p className="text-red-500 text-sm mb-4 p-3 bg-red-50 rounded">{error}</p>}

        <UserProfileForm 
          initialData={currentUser} 
          onSubmit={handleFormSubmit} 
          isLoading={isLoading} 
        />
      </div>
      {/* Animation style */}
       <style>{`
          @keyframes modal-enter {
            from { opacity: 0; transform: scale(0.95); }
            to { opacity: 1; transform: scale(1); }
          }
          .animate-modal-enter {
            animation: modal-enter 0.3s ease-out forwards;
          }
        `}</style>
    </div>
  );
};

export default UserProfileModal; 