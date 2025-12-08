'use client';

import * as React from "react";
import { cn } from "@/lib/utils";

const Tabs = React.forwardRef(({ className, children, defaultValue, ...props }, ref) => {
  const [value, setValue] = React.useState(defaultValue); // Internal state for uncontrolled usage
  
  // Also support controlled if needed, but for now simple uncontrolled is fine for this use case.
  // Actually, standard is usually controlled or using Context.
  // Let's implement a simple Context based Tabs for flexibility.
  
  return (
    <TabsContext.Provider value={{ value: props.value || value, onValueChange: props.onValueChange || setValue }}>
      <div ref={ref} className={cn("w-full", className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
});
Tabs.displayName = "Tabs";

const TabsContext = React.createContext({});

const TabsList = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "inline-flex h-10 items-center justify-center rounded-md bg-gray-100 p-1 text-gray-500",
      className
    )}
    {...props}
  />
));
TabsList.displayName = "TabsList";

const TabsTrigger = React.forwardRef(({ className, value, ...props }, ref) => {
    const { value: selectedValue, onValueChange } = React.useContext(TabsContext);
    const isSelected = selectedValue === value;
    
    return (
      <button
        ref={ref}
        type="button"
        role="tab"
        aria-selected={isSelected}
        onClick={() => onValueChange(value)}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
          isSelected ? "bg-white text-gray-950 shadow-sm" : "hover:bg-gray-200 hover:text-gray-900",
          className
        )}
        {...props}
      />
    );
});
TabsTrigger.displayName = "TabsTrigger";

const TabsContent = React.forwardRef(({ className, value, ...props }, ref) => {
    const { value: selectedValue } = React.useContext(TabsContext);
    
    if (selectedValue !== value) return null;

    return (
      <div
        ref={ref}
        role="tabpanel"
        className={cn(
          "mt-2 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-950 focus-visible:ring-offset-2",
          className
        )}
        {...props}
      />
    );
});
TabsContent.displayName = "TabsContent";

export { Tabs, TabsList, TabsTrigger, TabsContent };
