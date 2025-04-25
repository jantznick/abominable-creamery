import React from 'react';
import classNames from 'classnames';
import { SectionHeader } from './SectionHeader';
import { FormInput } from '../ui/FormInput';
import { Address } from '../../types/data'; // Adjust path as needed
import { useAuth } from '../../context/AuthContext'; // Need auth context to conditionally show save checkbox

interface ShippingSectionProps {
    // State Props
    fullName: string;
    address1: string;
    address2: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    selectedAddressId: string;
    saveNewAddress: boolean;
    savedAddresses: Address[];
    isLoadingAddresses: boolean;
    errorLoadingAddresses: string | null;
    isActive: boolean;
    isComplete: boolean;
    canCompleteShipping: boolean;
    isContactComplete: boolean; // Needed to enable/disable the section wrapper

    // Setter Props
    setFullName: (value: string) => void;
    setAddress1: (value: string) => void;
    setAddress2: (value: string) => void;
    setCity: (value: string) => void;
    setState: (value: string) => void;
    setPostalCode: (value: string) => void;
    setCountry: (value: string) => void;
    setSaveNewAddress: (value: boolean) => void;

    // Handler Props
    handleSelectAddress: (event: React.ChangeEvent<HTMLSelectElement>) => void;
    onContinue: () => void;
    onEdit: () => void;
}

export const ShippingSection: React.FC<ShippingSectionProps> = ({
    fullName, address1, address2, city, state, postalCode, country,
    selectedAddressId, saveNewAddress, savedAddresses, isLoadingAddresses, errorLoadingAddresses,
    isActive, isComplete, canCompleteShipping, isContactComplete,
    setFullName, setAddress1, setAddress2, setCity, setState, setPostalCode, setCountry, setSaveNewAddress,
    handleSelectAddress, onContinue, onEdit
}) => {
    const auth = useAuth(); // Get auth state

    return (
        <div className={classNames(
            "bg-white p-6 rounded-lg shadow-md",
            { 'opacity-50 pointer-events-none': !isContactComplete } // Disable based on previous step completion
        )}
        >
            <SectionHeader
                title="2. Shipping Address"
                isComplete={isComplete}
                isActive={isActive}
                onEdit={onEdit}
            />
            {/* Show form if section is active AND previous is complete, otherwise show read-only view IF this section complete */}
            {isActive && isContactComplete ? (
                <div className="space-y-4">
                    {/* Saved Address Dropdown */}
                    {auth.user && savedAddresses.length > 0 && (
                        <div className="mb-6 pb-4 border-b border-slate-200">
                            <label htmlFor="savedAddress" className="block text-sm font-medium text-slate-700 mb-1">Use a Saved Address</label>
                            <select id="savedAddress" name="savedAddress" value={selectedAddressId} onChange={handleSelectAddress} className="block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2">
                                <option value="">-- Enter New Address Below --</option>
                                {savedAddresses.filter(addr => addr.type === 'SHIPPING').map(addr => (
                                    <option key={addr.id} value={addr.id}> {addr.streetAddress}, {addr.city} {addr.isDefault ? '(Default)' : ''}</option>
                                ))}
                            </select>
                            {isLoadingAddresses && <p className="text-sm text-slate-500 mt-1">Loading addresses...</p>}
                            {errorLoadingAddresses && <p className="text-sm text-red-500 mt-1">Error: {errorLoadingAddresses}</p>}
                        </div>
                    )}
                    {/* Manual input fields */}
                    <FormInput label="Full Name" id="fullName" type="text" value={fullName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFullName(e.target.value)} required />
                    <FormInput label="Street Address" id="address1" type="text" value={address1} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAddress1(e.target.value)} required />
                    <FormInput label="Apartment, suite, etc. (Optional)" id="address2" type="text" value={address2} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAddress2(e.target.value)} />
                    <FormInput label="City" id="city" type="text" value={city} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCity(e.target.value)} required />
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <FormInput label="Country" id="country" type="text" value={country} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCountry(e.target.value)} required />
                        <FormInput label="State / Province" id="state" type="text" value={state} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setState(e.target.value)} required />
                        <FormInput label="Postal Code" id="postalCode" type="text" value={postalCode} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPostalCode(e.target.value)} required />
                    </div>
                    {/* Save Address Checkbox */}
                    {auth.user && selectedAddressId === '' && (
                        <div className="flex items-center mt-4 pt-4 border-t border-slate-200">
                            <input id="saveNewAddress" name="saveNewAddress" type="checkbox" checked={saveNewAddress} onChange={(e) => setSaveNewAddress(e.target.checked)} className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded" />
                            <label htmlFor="saveNewAddress" className="ml-2 block text-sm text-gray-900">Save this address to my profile</label>
                        </div>
                    )}
                    {/* Continue button */}
                    <button
                        type="button"
                        onClick={onContinue}
                        disabled={!canCompleteShipping}
                        className="w-full mt-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg text-lg transition-colors duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Continue to Payment
                    </button>
                </div> // End content wrapper
            ) : isComplete ? (
                <div className="text-slate-600 text-sm">
                    <p>{fullName}</p>
                    <p>{address1}{address2 ? `, ${address2}` : ''}</p>
                    <p>{city}, {state} {postalCode}</p>
                    <p>{country}</p>
                </div>
            ) : null}
        </div>
    );
}; 