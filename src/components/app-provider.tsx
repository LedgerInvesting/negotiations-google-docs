"use client";

import { ReactNode } from "react";
import { FullscreenLoader } from "./fullscreen-loader";
import { ClerkProvider, useAuth, SignIn } from "@clerk/nextjs";
import { SWRConfig } from 'swr';

export function AppProvider({ children }: { children: ReactNode }) {
  const { isLoaded, userId } = useAuth();

  if (!isLoaded) {
    return <FullscreenLoader label="Auth loading..." />;
  }

  if (!userId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <SignIn routing="hash" />
      </div>
    );
  }

  return (
    <SWRConfig
      value={{
        fetcher: (url: string) => fetch(url).then((res) => res.json()),
        revalidateOnFocus: false,
      }}
    >
      {children}
    </SWRConfig>
  );
}

export function RootProvider({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY!}>
      <AppProvider>{children}</AppProvider>
    </ClerkProvider>
  );
}
