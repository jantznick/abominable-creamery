import React, { useState, useEffect, FormEvent } from 'react';

// Data structure for the form submission
export interface UserProfileFormData {
  name: string | null; // Allow null if user wants to clear name
  email: string;
  phone: string | null; // Add optional phone field
}

interface UserProfileFormProps {
  initialData: { 
      name: string | null; 
      email: string; 
      phone: string | null; // Add phone to initial data
  }; 
  onSubmit: (formData: UserProfileFormData) => Promise<void>; // Async submit handler
  isLoading: boolean;
  submitButtonText?: string;
}

const UserProfileForm: React.FC<UserProfileFormProps> = ({
  initialData,
  onSubmit,
  isLoading,
  submitButtonText = 'Update Profile'
}) => {
  const [formData, setFormData] = useState<UserProfileFormData>({
    name: initialData.name ?? '', // Use empty string in form for null name
    email: initialData.email || '',
    phone: initialData.phone ?? '', // Initialize phone state
  });

  // Update form if initialData prop changes (e.g., parent re-fetches user data)
  useEffect(() => {
    setFormData({
        name: initialData.name ?? '',
        email: initialData.email || '',
        phone: initialData.phone ?? '', // Update phone on prop change
    });
  }, [initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    // Prepare data for submission: convert empty name/phone string back to null
    const trimmedName = formData.name ? formData.name.trim() : null; 
    const finalName = trimmedName === '' ? null : trimmedName; 

    const trimmedPhone = formData.phone ? formData.phone.trim() : null; // Trim phone
    const finalPhone = trimmedPhone === '' ? null : trimmedPhone; // Ensure empty string becomes null
    
    const submitData: UserProfileFormData = {
        email: formData.email, // Email is required
        name: finalName, 
        phone: finalPhone, // Include final phone value
    }
    onSubmit(submitData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Name Field */}
      <div>
        <label htmlFor="profile-name" className="block text-sm font-medium text-gray-700">Name</label>
        <input
          type="text"
          id="profile-name"
          name="name"
          value={formData.name ?? ''} 
          onChange={handleChange}
          disabled={isLoading}
          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100"
        />
      </div>

      {/* Email Field */}
      <div>
        <label htmlFor="profile-email" className="block text-sm font-medium text-gray-700">Email Address</label>
        <input
          type="email"
          id="profile-email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          required // Email is required
          disabled={isLoading}
          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100"
        />
      </div>

      {/* Phone Field (Optional) */}
      <div>
        <label htmlFor="profile-phone" className="block text-sm font-medium text-gray-700">Phone Number <span className="text-gray-500">(Optional)</span></label>
        <input
          type="tel" // Use type="tel" for phone numbers
          id="profile-phone"
          name="phone"
          value={formData.phone ?? ''} // Handle potential null value
          onChange={handleChange}
          disabled={isLoading}
          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100"
          placeholder="e.g., +1 555-123-4567"
        />
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

export default UserProfileForm; 