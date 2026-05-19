import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function parseDate(dateObj: any): Date | null {
  if (!dateObj) return null;
  if (typeof dateObj.toDate === 'function') {
    return dateObj.toDate();
  }
  if (typeof dateObj.seconds === 'number') {
    return new Date(dateObj.seconds * 1000);
  }
  const date = new Date(dateObj);
  if (isNaN(date.getTime())) return null;
  return date;
}

export function formatCurrency(amount: number | undefined) {
  if (amount === undefined) return "0 XAF";
  return new Intl.NumberFormat('fr-FR').format(amount) + ' XAF';
}

