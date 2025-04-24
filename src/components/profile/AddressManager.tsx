import React, { useState, useEffect, useCallback } from 'react';
import AddressModal from './AddressModal'; // Import the modal
import { Address } from '../../types/data'; // Import shared Address type
import ConfirmationModal from '../common/ConfirmationModal'; // Import ConfirmationModal

interface AddressManagerProps {
  // Props might be needed later, e.g., to pass down user ID or initial addresses
}

const AddressManager: React.FC<AddressManagerProps> = () => {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- Modal State ---
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);

  // --- Confirmation Modal State ---
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [addressToDeleteId, setAddressToDeleteId] = useState<number | null>(null);

  // Function to fetch addresses
  const fetchAddresses = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/addresses');
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required. Please log in again.'); // Or handle redirect
        }
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch addresses');
      }
      const data: Address[] = await response.json();
      setAddresses(data);
    } catch (err: any) {
      console.error("Fetch Addresses Error:", err);
      setError(err.message || 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch addresses on component mount
  useEffect(() => {
    fetchAddresses();
  }, [fetchAddresses]);

  // --- Delete Logic ---
  const handleDeleteInitiate = (addressId: number) => {
    setAddressToDeleteId(addressId); // Store the ID of the address to delete
    setIsConfirmModalOpen(true);     // Open the confirmation modal
  };

  const confirmDelete = async () => {
    if (addressToDeleteId === null) return;

    setIsSubmitting(true); // Use the generic submitting state
    setError(null); 

    try {
      const response = await fetch(`/api/addresses/${addressToDeleteId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        let errorMsg = 'Failed to delete address.';
        if (response.status === 404) {
          errorMsg = 'Address not found or you do not have permission to delete it.';
        } else if (response.status === 401) {
          errorMsg = 'Authentication required.';
        } else {
          try { const errorData = await response.json(); errorMsg = errorData.message || errorMsg; } catch {} 
        }
        throw new Error(errorMsg);
      }

      setAddresses(prevAddresses => prevAddresses.filter(addr => addr.id !== addressToDeleteId));
      closeConfirmModal(); // Close modal on success

    } catch (err: any) {
      console.error("Delete Address Error:", err);
      setError(err.message || 'An unknown error occurred during deletion');
      // Keep the modal open to show the error?
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeConfirmModal = () => {
    setIsConfirmModalOpen(false);
    setAddressToDeleteId(null);
  };
  // --- End Delete Logic ---

  // Function to handle setting an address as default
  const handleSetDefault = async (addressId: number) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/addresses/${addressId}/default`, {
        method: 'PUT',
        headers: {
            // Although PUT might not strictly need this, it's good practice
            'Content-Type': 'application/json' 
        },
        // No body needed for this specific endpoint
      });

      if (!response.ok) {
        let errorMsg = 'Failed to set default address.';
        if (response.status === 404) {
          errorMsg = 'Address not found or you do not have permission to modify it.';
        } else if (response.status === 401) {
          errorMsg = 'Authentication required. Please log in again.';
        } else {
          try {
             const errorData = await response.json();
             errorMsg = errorData.message || errorMsg;
          } catch { /* Ignore if response body is not JSON */ }
        }
        throw new Error(errorMsg);
      }

      // If successful (200 OK), update local state
      const updatedAddress: Address = await response.json();
      
      setAddresses(prevAddresses => 
        prevAddresses.map(addr => {
          if (addr.id === updatedAddress.id) {
            // This is the one that was just set as default
            return { ...addr, isDefault: true }; 
          } else if (addr.type === updatedAddress.type) {
            // This is another address of the same type, unset its default status
            return { ...addr, isDefault: false };
          } else {
            // This address is of a different type, leave it unchanged
            return addr;
          }
        })
      );
      // Optionally, show a success notification

    } catch (err: any) {
      console.error("Set Default Address Error:", err);
      setError(err.message || 'An unknown error occurred while setting default');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Modal Control Functions ---
  const openAddModal = () => {
    setEditingAddress(null); // Ensure we are in "add" mode
    setIsAddressModalOpen(true);
  };

  const openEditModal = (address: Address) => {
    setEditingAddress(address); // Set the address to edit
    setIsAddressModalOpen(true);
  };

  const closeAddressModal = (refreshNeeded?: boolean) => {
    setIsAddressModalOpen(false);
    setEditingAddress(null); // Clear editing state
    if (refreshNeeded) {
      fetchAddresses(); // Refetch addresses if an add/edit occurred
    }
  };

  return (
    <div className="mt-6">
      <h3 className="text-lg font-semibold mb-4 border-b pb-2">Saved Addresses</h3>
      {isLoading && (
          <p className="text-slate-500">
              <div className="spinner border-t-2 border-blue-500 border-solid rounded-full w-4 h-4 animate-spin inline-block mr-2"></div>
              Loading addresses...
          </p>
      )}
      {error && <p className="text-red-500 bg-red-50 p-3 rounded mb-4"><span className="font-bold">Error:</span> {error}</p>}
      {!isLoading && !error && (
        <div className="space-y-4">
          {addresses.length === 0 ? (
            <p className="text-slate-500 bg-slate-50 p-4 rounded">You have no saved addresses.</p>
          ) : (
            addresses.map((address) => (
              <div key={address.id} className="border p-4 rounded-md shadow-sm bg-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="flex-grow">
                  <p className="font-medium">
                    {address.streetAddress}, {address.city}, {address.state} {address.postalCode}
                    {address.isDefault && 
                      <span className="ml-2 text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full align-middle">Default</span>
                    }
                  </p>
                  <p className="text-sm text-slate-600">{address.country}</p>
                </div>
                <div className="mt-2 sm:mt-0 flex-shrink-0 flex items-center space-x-2">
                  <button 
                    title="Edit Address"
                    onClick={() => openEditModal(address)} 
                    className="p-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    disabled={isSubmitting} 
                  >
                     <span className="material-symbols-outlined text-base align-middle">edit</span> 
                  </button>
                  {!address.isDefault && (
                    <button 
                      title="Set as Default"
                      onClick={() => handleSetDefault(address.id)} 
                      className="p-1.5 text-sm text-green-600 hover:bg-green-50 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      disabled={isSubmitting} 
                    >
                       <span className="material-symbols-outlined text-base align-middle">check_circle</span> 
                    </button>
                  )}
                  <button 
                    title="Delete Address"
                    onClick={() => handleDeleteInitiate(address.id)} 
                    className="p-1.5 text-sm text-red-600 hover:bg-red-50 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    disabled={isSubmitting} 
                  >
                     <span className="material-symbols-outlined text-base align-middle">delete</span> 
                  </button>
                </div>
              </div>
            ))
          )}
          <button 
            onClick={openAddModal} 
            className="mt-6 inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 text-sm font-medium disabled:opacity-50"
            disabled={isLoading || isSubmitting} 
          >
             <span className="material-symbols-outlined text-base mr-1 align-middle">add</span> 
            Add New Address
          </button>
        </div>
      )}

      {/* Render the Address Modal */}
      <AddressModal 
        isOpen={isAddressModalOpen} 
        onClose={closeAddressModal} 
        addressToEdit={editingAddress} 
      />

      {/* Render the Confirmation Modal */}
      <ConfirmationModal
        isOpen={isConfirmModalOpen}
        onClose={closeConfirmModal}
        onConfirm={confirmDelete}
        title="Delete Address"
        message="Are you sure you want to delete this address? This action cannot be undone."
        confirmButtonText="Delete"
        isLoading={isSubmitting}
      />
    </div>
  );
};

export default AddressManager; 