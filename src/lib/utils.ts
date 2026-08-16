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

export function sortByDateDesc<T extends Record<string, any>>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const rawA = a.createdAt || a.date || a.timestamp || a.created_at || a.deliveredAt || a.orderDate;
    const rawB = b.createdAt || b.date || b.timestamp || b.created_at || b.deliveredAt || b.orderDate;
    const dateA = parseDate(rawA);
    const dateB = parseDate(rawB);
    const timeA = dateA ? dateA.getTime() : 0;
    const timeB = dateB ? dateB.getTime() : 0;
    return timeB - timeA;
  });
}

export function formatCurrency(amount: number | undefined) {
  if (amount === undefined) return "0 XAF";
  return new Intl.NumberFormat('fr-FR').format(amount) + ' XAF';
}

