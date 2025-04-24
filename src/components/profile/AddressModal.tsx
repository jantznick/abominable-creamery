import React, { useState, FormEvent, useEffect } from 'react';
import AddressForm from './AddressForm'; 
import { Address, AddressFormData } from '../../types/data'; // Import shared types

// Remove local Address interface definition
/*
interface Address {
  id: number;
  type: 'SHIPPING' | 'BILLING';
  streetAddress: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
}
*/

interface AddressModalProps {
  isOpen: boolean;
  onClose: (refreshNeeded?: boolean) => void; // Pass flag if list needs refreshing
  addressToEdit?: Address | null; // Use shared Address type
}

const AddressModal: React.FC<AddressModalProps> = ({ isOpen, onClose, addressToEdit = null }) => {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Reset error when modal opens/closes or when switching between add/edit
  useEffect(() => {
    if (isOpen) {
      setError(null); 
    }
  }, [isOpen, addressToEdit]);

  const handleFormSubmit = async (formData: AddressFormData) => {
    setIsLoading(true);
    setError(null);
    
    const isEditing = addressToEdit !== null;
    const url = isEditing ? `/api/addresses/${addressToEdit.id}` : '/api/addresses';
    const method = isEditing ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        onClose(true); // Close modal and indicate refresh needed
      } else {
        setError(data.message || (isEditing ? 'Failed to update address.' : 'Failed to add address.'));
      }
    } catch (err) {
      console.error('Address Form Submit error:', err);
      setError('An unexpected network error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    // Modal backdrop (Similar structure to LoginModal)
    <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-center items-center p-4 transition-opacity duration-300 ease-in-out">
      {/* Modal container */}
      <div className="bg-white p-6 md:p-8 rounded-lg shadow-xl z-50 w-full max-w-lg relative transform transition-all duration-300 ease-in-out scale-95 opacity-0 animate-modal-enter">
        {/* Close button */}
        <button
          onClick={() => onClose()} // Close without refresh flag
          className="absolute top-2 right-3 text-gray-400 hover:text-gray-600 text-2xl font-light"
          aria-label="Close address form"
        >
          &times;
        </button>

        <h2 className="text-xl font-semibold mb-5 text-gray-800">
          {addressToEdit ? 'Edit Address' : 'Add New Address'}
        </h2>

        {/* Display submit errors here */}
        {error && <p className="text-red-500 text-sm mb-4 p-3 bg-red-50 rounded">{error}</p>}

        <AddressForm 
          initialData={addressToEdit} 
          onSubmit={handleFormSubmit} 
          isLoading={isLoading} 
          submitButtonText={addressToEdit ? 'Update Address' : 'Add Address'}
        />
      </div>
        {/* Basic CSS Animation - add to your global CSS or Tailwind config */}
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

export default AddressModal; 