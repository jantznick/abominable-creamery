import React, { useState, useEffect, FormEvent } from 'react';
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

// Remove local AddressFormData type definition
// export type AddressFormData = Omit<Address, 'id'>;

interface AddressFormProps {
  initialData?: Address | null; // Use shared Address type
  onSubmit: (formData: AddressFormData) => Promise<void>; // Use shared AddressFormData type
  isLoading: boolean;
  submitButtonText?: string;
  // We might pass down an error object or display errors passed from parent modal
}

const AddressForm: React.FC<AddressFormProps> = ({
  initialData = null,
  onSubmit,
  isLoading,
  submitButtonText = 'Save Address'
}) => {
  // Initialize form state, including type defaulting to SHIPPING
  const [formData, setFormData] = useState<AddressFormData>(() => ({
    type: initialData?.type || 'SHIPPING', // Keep type in state, default SHIPPING
    streetAddress: initialData?.streetAddress || '',
    city: initialData?.city || '',
    state: initialData?.state || '',
    postalCode: initialData?.postalCode || '',
    country: initialData?.country || 'US',
    isDefault: initialData?.isDefault || false,
  }));

  // Update form state if initialData changes
  useEffect(() => {
    if (initialData) {
      setFormData({
        type: initialData.type, // Keep type update from initialData
        streetAddress: initialData.streetAddress,
        city: initialData.city,
        state: initialData.state,
        postalCode: initialData.postalCode,
        country: initialData.country,
        isDefault: initialData.isDefault,
      });
    } else {
      // Reset form if initialData becomes null
       setFormData({
        type: 'SHIPPING', // Reset type to SHIPPING
        streetAddress: '',
        city: '',
        state: '',
        postalCode: '',
        country: 'US',
        isDefault: false,
      });
    }
  }, [initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    // Handle checkbox separately
    const isCheckbox = type === 'checkbox';
    const inputValue = isCheckbox ? (e.target as HTMLInputElement).checked : value;

    setFormData(prev => ({
      ...prev,
      [name]: inputValue,
    }));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    // Prepare data for submission
    // const trimmedName = formData.name ? formData.name.trim() : null; // REMOVE - Incorrect field
    // const finalName = trimmedName === '' ? null : trimmedName; // REMOVE
    
    const submitData: AddressFormData = {
        ...formData, // Submit the current form state (includes type: 'SHIPPING')
        // Optionally trim other string fields here if desired
        streetAddress: formData.streetAddress.trim(), 
        city: formData.city.trim(),
        state: formData.state.trim(),
        postalCode: formData.postalCode.trim(),
        country: formData.country.trim(),
    }
    onSubmit(submitData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Type field is not rendered, but type is included in formData state */}
      {/* Address Type - REMOVED */}
      {/* 
      <div>
        <label htmlFor="type" className="block text-sm font-medium text-gray-700">Address Type</label>
        <select
          id="type"
          name="type"
          value={formData.type}
          onChange={handleChange}
          disabled={isLoading}
          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md shadow-sm disabled:bg-gray-100"
        >
          <option value="SHIPPING">Shipping</option>
          <option value="BILLING">Billing</option>
        </select>
      </div>
      */}

      {/* Street Address */}
      <div>
        <label htmlFor="streetAddress" className="block text-sm font-medium text-gray-700">Street Address</label>
        <input
          type="text"
          id="streetAddress"
          name="streetAddress"
          value={formData.streetAddress}
          onChange={handleChange}
          required
          disabled={isLoading}
          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100"
        />
      </div>

      {/* City */}
      <div>
        <label htmlFor="city" className="block text-sm font-medium text-gray-700">City</label>
        <input
          type="text"
          id="city"
          name="city"
          value={formData.city}
          onChange={handleChange}
          required
          disabled={isLoading}
          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100"
        />
      </div>

      {/* State / Province */}
      <div>
        <label htmlFor="state" className="block text-sm font-medium text-gray-700">State / Province</label>
        <input
          type="text"
          id="state"
          name="state"
          value={formData.state}
          onChange={handleChange}
          required
          disabled={isLoading}
          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100"
        />
      </div>

      {/* Postal Code */}
      <div>
        <label htmlFor="postalCode" className="block text-sm font-medium text-gray-700">Postal Code</label>
        <input
          type="text"
          id="postalCode"
          name="postalCode"
          value={formData.postalCode}
          onChange={handleChange}
          required
          disabled={isLoading}
          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100"
        />
      </div>

      {/* Country */} 
      <div>
        <label htmlFor="country" className="block text-sm font-medium text-gray-700">Country</label>
        {/* Consider using a select dropdown for countries later */}
        <input
          type="text"
          id="country"
          name="country"
          value={formData.country}
          onChange={handleChange}
          required
          disabled={isLoading}
          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100"
        />
      </div>

      {/* Default Address Checkbox */}
      <div className="flex items-center">
        <input
          id="isDefault"
          name="isDefault"
          type="checkbox"
          checked={formData.isDefault}
          onChange={handleChange}
          disabled={isLoading}
          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded disabled:opacity-50"
        />
        <label htmlFor="isDefault" className="ml-2 block text-sm text-gray-900">
          Set as default address 
        </label>
      </div>

      {/* Submit Button */}
      <div className="pt-2">
        <button
          type="submit"
          disabled={isLoading}
          className={`w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white ${isLoading ? 'bg-indigo-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'}`}
        >
          {isLoading ? 'Saving...' : submitButtonText}
        </button>
      </div>
    </form>
  );
};

export default AddressForm; 