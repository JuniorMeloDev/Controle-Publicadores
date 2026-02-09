'use client';

import { createContext, useContext } from 'react';

const PermissionsContext = createContext({
  permissions: null,
  isLoading: true,
});

export const PermissionsProvider = ({ permissions, isLoading, children }) => (
  <PermissionsContext.Provider value={{ permissions, isLoading }}>
    {children}
  </PermissionsContext.Provider>
);

export const usePermissions = () => useContext(PermissionsContext);
