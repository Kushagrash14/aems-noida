import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '—';
  try {
    const d = new Date(dateString);
    return d.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateString;
  }
}

export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return '—';
  try {
    const d = new Date(dateString);
    return d.toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
}

export function formatCompactNumber(num: number): string {
  if (num >= 10000000) return `${(num / 10000000).toFixed(2)} Cr`;
  if (num >= 100000) return `${(num / 100000).toFixed(2)} Lakh`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return num.toLocaleString('en-IN');
}

export interface DepreciationResult {
  originalCost: number;
  currentBookValue: number;
  accumulatedDepreciation: number;
  depreciationPercentage: number;
  ageYears: number;
}

export function calculateAssetDepreciation(
  cost: number | null | undefined,
  purchaseDateStr: string | null | undefined,
  categoryNameOrCode?: string | null
): DepreciationResult {
  const originalCost = Number(cost) || 0;
  if (originalCost <= 0) {
    return {
      originalCost: 0,
      currentBookValue: 0,
      accumulatedDepreciation: 0,
      depreciationPercentage: 0,
      ageYears: 0,
    };
  }

  // Determine standard useful lifespan in years based on equipment classification
  const cat = (categoryNameOrCode || '').toLowerCase();
  let lifespanYears = 5;
  if (cat.includes('it') || cat.includes('laptop') || cat.includes('desktop') || cat.includes('comput') || cat.includes('soft') || cat.includes('cam')) {
    lifespanYears = 3;
  } else if (cat.includes('machin') || cat.includes('mold') || cat.includes('tool') || cat.includes('elec') || cat.includes('prod') || cat.includes('press')) {
    lifespanYears = 7;
  } else if (cat.includes('furn') || cat.includes('veh')) {
    lifespanYears = 5;
  }

  // Calculate age
  let ageYears = 0.5; // default 6 months if purchase date not recorded
  if (purchaseDateStr) {
    const pDate = new Date(purchaseDateStr);
    if (!isNaN(pDate.getTime())) {
      const now = new Date();
      const diffTime = Math.max(0, now.getTime() - pDate.getTime());
      ageYears = diffTime / (1000 * 60 * 60 * 24 * 365.25);
    }
  }

  // Straight-line depreciation with 5% scrap/salvage value retention
  const salvageValue = originalCost * 0.05;
  const depreciableAmount = originalCost - salvageValue;
  const annualDepreciationRate = depreciableAmount / lifespanYears;

  const accumulatedDepreciation = Math.min(
    depreciableAmount,
    Math.max(0, annualDepreciationRate * ageYears)
  );

  const currentBookValue = Math.max(salvageValue, originalCost - accumulatedDepreciation);
  const depreciationPercentage = originalCost > 0 ? (accumulatedDepreciation / originalCost) * 100 : 0;

  return {
    originalCost,
    currentBookValue,
    accumulatedDepreciation,
    depreciationPercentage: Math.round(depreciationPercentage * 10) / 10,
    ageYears: Math.round(ageYears * 10) / 10,
  };
}
