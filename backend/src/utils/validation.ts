/**
 * Email validation
 */
export const validateEmail = (email: string): boolean => {
  if (!email || typeof email !== 'string') return false;
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim().toLowerCase());
};

/**
 * Password validation result interface
 */
export interface PasswordValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Password validation with detailed requirements
 */
export const validatePassword = (password: string): PasswordValidationResult => {
  if (!password || typeof password !== 'string') {
    return {
      isValid: false,
      error: 'Password is required and must be a string'
    };
  }

  if (password.length < 6) {
    return {
      isValid: false,
      error: 'Password must be at least 6 characters long'
    };
  }

  const hasNumber = /\d/.test(password);
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  const requirements = [];
  if (!hasNumber) requirements.push('one number');
  if (!hasUpperCase) requirements.push('one uppercase letter');
  if (!hasLowerCase) requirements.push('one lowercase letter');
  if (!hasSpecialChar) requirements.push('one special character');

  if (requirements.length > 0) {
    return {
      isValid: false,
      error: `Password must contain at least ${requirements.join(', ')}`
    };
  }

  if (password.length > 50) {
    return {
      isValid: false,
      error: 'Password cannot exceed 50 characters'
    };
  }

  return { isValid: true };
};

/**
 * Name validation
 */
export const validateName = (name: string): { isValid: boolean; error?: string } => {
  if (!name || typeof name !== 'string') {
    return {
      isValid: false,
      error: 'Name is required and must be a string'
    };
  }

  const trimmedName = name.trim();
  
  if (trimmedName.length < 2) {
    return {
      isValid: false,
      error: 'Name must be at least 2 characters long'
    };
  }

  if (trimmedName.length > 50) {
    return {
      isValid: false,
      error: 'Name cannot exceed 50 characters'
    };
  }

  // Check for valid characters (letters, spaces, hyphens, apostrophes)
  const nameRegex = /^[a-zA-Z\s'-]+$/;
  if (!nameRegex.test(trimmedName)) {
    return {
      isValid: false,
      error: 'Name can only contain letters, spaces, hyphens, and apostrophes'
    };
  }

  return { isValid: true };
}; 