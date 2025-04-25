import React from 'react';
import { SectionHeader } from './SectionHeader'; // Re-use SectionHeader
import { FormInput } from '../ui/FormInput'; // Import from the new location

interface ContactSectionProps {
    email: string;
    setEmail: (value: string) => void;
    phone: string;
    setPhone: (value: string) => void;
    isActive: boolean;
    isComplete: boolean;
    canCompleteContact: boolean;
    onContinue: () => void;
    onEdit: () => void;
}

export const ContactSection: React.FC<ContactSectionProps> = ({
    email,
    setEmail,
    phone,
    setPhone,
    isActive,
    isComplete,
    canCompleteContact,
    onContinue,
    onEdit
}) => {
    return (
        <div className="bg-white p-6 rounded-lg shadow-md">
            <SectionHeader
                title="1. Contact Information"
                isComplete={isComplete}
                isActive={isActive}
                onEdit={onEdit}
            />
            {/* Show form if section is active, otherwise show read-only view IF complete */}
            {isActive ? (
                <div className="space-y-4">
                    <FormInput
                        label="Email Address"
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                        required
                        placeholder="you@example.com"
                    />
                    <FormInput
                        label="Phone Number"
                        id="phone"
                        type="tel"
                        value={phone}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPhone(e.target.value)}
                        required
                        placeholder="(555) 123-4567"
                    />
                    <button
                        type="button"
                        onClick={onContinue}
                        disabled={!canCompleteContact}
                        className="w-full mt-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg text-lg transition-colors duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Continue to Shipping
                    </button>
                </div>
            ) : isComplete ? (
                <div className="text-slate-600 text-sm">
                    <p>Email: {email}</p>
                    {phone && <p>Phone: {phone}</p>}
                </div>
            ) : null}
        </div>
    );
}; 