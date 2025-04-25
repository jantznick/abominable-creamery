import React from 'react';

// Define props including label, id, and allow any other standard input props
interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label: string;
    id: string;
}

export const FormInput: React.FC<FormInputProps> = ({ label, id, ...props }) => {
    return (
        <div>
            <label htmlFor={id} className="block text-sm font-medium text-slate-700 mb-1">
                {label}
            </label>
            <input
                id={id}
                className="block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 disabled:bg-slate-100 disabled:cursor-not-allowed"
                {...props} // Spread remaining props (type, value, onChange, required, placeholder, etc.)
            />
        </div>
    );
}; 