// Format phone number as user types: (555) 123-4567
export const formatPhoneNumber = (value) => {
  // Remove all non-digits
  const phoneNumber = value.replace(/\D/g, '');
  
  // Limit to 10 digits
  const trimmed = phoneNumber.slice(0, 10);
  
  // Format the number
  if (trimmed.length === 0) return '';
  if (trimmed.length <= 3) return `(${trimmed}`;
  if (trimmed.length <= 6) return `(${trimmed.slice(0, 3)}) ${trimmed.slice(3)}`;
  return `(${trimmed.slice(0, 3)}) ${trimmed.slice(3, 6)}-${trimmed.slice(6)}`;
};

// Get clean 10-digit number from formatted string
export const getCleanPhoneNumber = (formattedValue) => {
  return formattedValue.replace(/\D/g, '').slice(0, 10);
};

// Validate if the phone number is complete (10 digits)
export const isValidPhoneNumber = (formattedValue) => {
  const clean = getCleanPhoneNumber(formattedValue);
  return clean.length === 10;
};
