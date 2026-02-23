"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { inArray } from "drizzle-orm";

export async function getDocuments(ids: string[]) {
  // Query the database directly instead of using fetch (which doesn't work in server actions)
  const foundDocs = await db
    .select({
      id: documents.id,
      title: documents.title,
    })
    .from(documents)
    .where(inArray(documents.id, ids));

  return ids.map((id: string) => {
    const doc = foundDocs.find((d) => d.id === id);
    return doc ? { id: doc.id, name: doc.title } : { id, name: '[Removed]' };
  });
}

export async function getUsers() {
  const { sessionClaims } = await auth();
  const clerk = await clerkClient();

  // If user is in an organization, fetch all organization members
  if (sessionClaims?.org_id) {
    const response = await clerk.users.getUserList({
      organizationId: [sessionClaims.org_id as string],
    });

    const users = response.data.map((user) => {
      const name = user.fullName ?? user.primaryEmailAddress?.emailAddress ?? "Anonymous";
      const nameToNumber = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const hue = Math.abs(nameToNumber) % 360;
      const color = `hsl(${hue}, 80%, 60%)`;

      return {
        id: user.id,
        name,
        avatar: user.imageUrl,
        color,
      };
    });

    return users;
  }

  // For personal documents (no organization), only return the current user
  const { userId } = await auth();
  if (!userId) {
    return [];
  }

  const user = await clerk.users.getUser(userId);
  const name = user.fullName ?? user.primaryEmailAddress?.emailAddress ?? "Anonymous";
  const nameToNumber = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const hue = Math.abs(nameToNumber) % 360;
  const color = `hsl(${hue}, 80%, 60%)`;

  return [
    {
      id: user.id,
      name,
      avatar: user.imageUrl,
      color,
    },
  ];
}
