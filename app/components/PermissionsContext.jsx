'use client';

import { createContext, useContext } from 'react';

const PermissionsContext = createContext({
  permissions: null,
  isLoading: true,
});

export const PermissionsProvider = ({ permissions, isLoading, user, children }) => (
  <PermissionsContext.Provider value={{ permissions, isLoading, user }}>
    {children}
  </PermissionsContext.Provider>
);

export const usePermissions = () => useContext(PermissionsContext);
