import { createContext, useContext } from 'react';

export interface InformationListContextValue {
  readonly selectable: boolean;
}

export const InformationListContext = createContext<InformationListContextValue | null>(null);

export function useOptionalInformationListContext(): InformationListContextValue | null {
  return useContext(InformationListContext);
}

export function useInformationListContext(part: string): InformationListContextValue {
  const context = useContext(InformationListContext);
  if (!context) {
    throw new Error(`${part} must be rendered inside InformationList.`);
  }
  return context;
}
