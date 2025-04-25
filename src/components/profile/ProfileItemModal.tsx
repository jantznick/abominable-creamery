import React, { useState, useEffect, ReactNode } from 'react';

// Generic props for the modal
interface ProfileItemModalProps {
  isOpen: boolean;
  onClose: () => void; // Simplified onClose, specific logic handled by parent
  title: string; // Title for the modal (e.g., "Add Address", "Edit Card")
  children: ReactNode; // Content of the modal (the form itself)
  // We might add optional props for actions like primary/secondary buttons later if needed
}

const ProfileItemModal: React.FC<ProfileItemModalProps> = ({ 
    isOpen, 
    onClose, 
    title, 
    children 
}) => {
    if (!isOpen) {
        return null;
    }

    // Add keydown listener for Escape key
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onClose]);

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-60 z-40 flex justify-center items-center p-4 transition-opacity duration-150 ease-in-out animate-fade-in" 
            onClick={onClose} // Close on backdrop click
            aria-labelledby="profile-item-modal-title"
            role="dialog"
            aria-modal="true"
        >
            <div 
                className="bg-white p-6 rounded-lg shadow-xl z-50 w-full max-w-lg transform transition-all duration-150 ease-in-out scale-95 opacity-0 animate-modal-enter" 
                onClick={e => e.stopPropagation()} // Prevent closing when clicking inside the modal
            >
                {/* Modal Header */}
                <div className="flex justify-between items-center mb-4 border-b pb-3">
                    <h2 id="profile-item-modal-title" className="text-lg font-semibold text-gray-800">{title}</h2>
                    <button 
                        onClick={onClose} 
                        className="text-gray-400 hover:text-gray-600"
                        aria-label="Close modal"
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* Modal Body - Render the form passed as children */}
                <div>
                    {children}
                </div>

            </div>
            {/* Animation Styles */}
            <style>{`
              @keyframes fade-in {
                from { opacity: 0; }
                to { opacity: 1; }
              }
              @keyframes modal-enter {
                from { opacity: 0; transform: scale(0.95); }
                to { opacity: 1; transform: scale(1); }
              }
              .animate-fade-in {
                 animation: fade-in 0.15s ease-out forwards;
              }
              .animate-modal-enter {
                animation: modal-enter 0.15s ease-out forwards;
              }
            `}</style>
        </div>
    );
};

export default ProfileItemModal; 