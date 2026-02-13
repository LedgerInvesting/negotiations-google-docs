"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function getDocuments(ids: number[]) {
  const { getToken } = await auth();
  const token = await getToken();
  
  const response = await fetch(`${API_URL}/api/documents/by-ids`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
    },
    body: JSON.stringify({ ids }),
  });

  if (!response.ok) {
    return [];
  }

  return await response.json();
}

export async function getUsers() {
  const { sessionClaims } = await auth();
  const clerk = await clerkClient();

  const response = await clerk.users.getUserList({
    organizationId: [sessionClaims?.org_id as string],
  });

  const users = response.data.map((user) => ({
    id: user.id,
    name: user.fullName ?? user.primaryEmailAddress?.emailAddress ?? "Anonymous",
    avatar: user.imageUrl,
    color: "",
  }));

  return users;
}
