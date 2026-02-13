"use client";

import { ReactNode } from "react";
import { FullscreenLoader } from "./fullscreen-loader";
import { ClerkProvider, SignIn, SignedIn, SignedOut, useUser } from "@clerk/nextjs";

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY!}>
      <SignedIn>{children}</SignedIn>
      <SignedOut>
        <div className="flex flex-col items-center justify-center min-h-screen">
          <SignIn routing="hash" />
        </div>
      </SignedOut>
    </ClerkProvider>
  );
}
