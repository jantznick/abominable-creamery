/**
 * Formats a North American phone number string (10 digits) into a standard format.
 * Returns the original string if it cannot be formatted.
 * Handles numbers optionally starting with '1' or '+1'.
 * @param phoneNumber - The phone number string to format.
 * @returns Formatted phone number (e.g., "(555) 123-4567") or the original string.
 */
export const formatPhoneNumber = (phoneNumber: string | null | undefined): string => {
    if (!phoneNumber) {
        return ''; // Return empty for null/undefined
    }

    // Remove non-digit characters except leading '+'
    const cleaned = phoneNumber.replace(/\D/g, '');

    // Handle potential country code (+1 or 1)
    let match;
    if (cleaned.length === 11 && (cleaned.startsWith('1'))) {
        match = cleaned.substring(1).match(/^(\d{3})(\d{3})(\d{4})$/); // Match 10 digits after removing leading 1
    } else if (cleaned.length === 10) {
         match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/); // Match 10 digits
    } else {
        match = null; // Does not match expected lengths
    }

    if (match) {
        // Format as (XXX) XXX-XXXX
        return `(${match[1]}) ${match[2]}-${match[3]}`;
    }

    // If it doesn't match the expected format, return the original string
    return phoneNumber; 
};

/**
 * Formats a date string into a more readable format (e.g., "January 1, 2024").
 * @param dateString - The date string to format.
 * @returns Formatted date string or the original if formatting fails.
 */
export const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return '';
    try {
        return new Date(dateString).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    } catch (e) {
        console.error("Error formatting date:", e);
        return dateString; // Return original on error
    }
};

/**
 * Formats a number or string into a currency string (e.g., "$10.50").
 * @param amount - The amount to format (number or string).
 * @returns Formatted currency string or "N/A" if input is invalid.
 */
export const formatCurrency = (amount: number | string | null | undefined): string => {
    if (amount === null || amount === undefined) return 'N/A';
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(num)) return 'N/A';
    return `$${num.toFixed(2)}`;
}; 