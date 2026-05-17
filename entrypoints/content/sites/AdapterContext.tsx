import { createContext, useContext, type ReactNode } from 'react';
import type { SiteCapabilities } from './types';

const AdapterContext = createContext<SiteCapabilities | null>(null);

export function AdapterProvider({
  value,
  children,
}: {
  value: SiteCapabilities;
  children: ReactNode;
}) {
  return <AdapterContext.Provider value={value}>{children}</AdapterContext.Provider>;
}

export function useCapabilities(): SiteCapabilities {
  const caps = useContext(AdapterContext);
  if (!caps) throw new Error('useCapabilities called outside AdapterProvider');
  return caps;
}
