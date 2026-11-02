import { createContext, useContext } from 'react';

// Only mounted under /demo. Existing application screens use their normal services otherwise.
export const DemoContext = createContext(null);
export const useDemoRuntime = () => useContext(DemoContext);
