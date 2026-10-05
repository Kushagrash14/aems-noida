'use client';

import { createContext, useContext } from 'react';
import { Asset } from '@/types/database';

export interface DrillDownApi {
  openAssets: (title: string, assets: Asset[], subtitle?: string) => void;
}

export const DrillDownContext = createContext<DrillDownApi>({ openAssets: () => {} });

export const useDrillDown = () => useContext(DrillDownContext);
