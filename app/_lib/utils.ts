import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function phoneMask(value: string): string {
  const numbers = value.replace(/\D/g, "");

  if (numbers.length <= 2) {
    return numbers;
  }

  if (numbers.length <= 7) {
    return numbers.replace(
      /(\d{2})(\d+)/,
      "($1) $2"
    );
  }

  if (numbers.length <= 11) {
    return numbers.replace(
      /(\d{2})(\d{4,5})(\d{0,4})/,
      "($1) $2-$3"
    );
  }

  return numbers.slice(0, 11).replace(
    /(\d{2})(\d{5})(\d{4})/,
    "($1) $2-$3"
  );
}

export function isValidBrazilianCellPhone(value: string): boolean {
  const numbers = value.replace(/\D/g, "");

  if (numbers.length !== 11) return false;

  const areaCode = numbers.slice(0, 2);
  const firstDigit = numbers.charAt(2);

  if (!/^[1-9]{2}$/.test(areaCode)) return false;
  if (firstDigit !== "9") return false;

  return true;
}