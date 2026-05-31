import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(10, "Password must be at least 10 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least one symbol (!@#$%^&*...)");

export interface PasswordStrength {
  score: number;
  requirements: {
    minLength: boolean;
    hasUppercase: boolean;
    hasLowercase: boolean;
    hasNumber: boolean;
    hasSymbol: boolean;
  };
}

export const checkPasswordStrength = (password: string): PasswordStrength => {
  const requirements = {
    minLength: password.length >= 10,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSymbol: /[^A-Za-z0-9]/.test(password),
  };

  const score = Object.values(requirements).filter(Boolean).length;

  return { score, requirements };
};

export const getPasswordErrors = (password: string): string[] => {
  const errors: string[] = [];
  
  if (password.length < 10) {
    errors.push("At least 10 characters");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("One uppercase letter");
  }
  if (!/[a-z]/.test(password)) {
    errors.push("One lowercase letter");
  }
  if (!/[0-9]/.test(password)) {
    errors.push("One number");
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push("One symbol (!@#$%^&*...)");
  }
  
  return errors;
};
