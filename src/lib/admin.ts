import { useUser } from '@clerk/clerk-react';

// Admin Clerk user IDs — must match ADMIN_USER_IDS in wrangler.toml (the backend is authoritative;
// this is only for client UX like showing/hiding the admin nav link). Keep in sync.
// Can be overridden at build time with VITE_ADMIN_USER_IDS="user_x,user_y".
const BUILT_IN_ADMIN_IDS = ['user_3CNt5U6NsmyiW5oWl131ulqnFIk'];

function parseAdminIds(): string[] {
  const envList = (import.meta.env.VITE_ADMIN_USER_IDS as string | undefined) || '';
  const extra = envList.split(',').map(s => s.trim()).filter(Boolean);
  return [...new Set([...BUILT_IN_ADMIN_IDS, ...extra])];
}

export const ADMIN_USER_IDS = parseAdminIds();

export function useIsAdmin(): { isAdmin: boolean; isLoaded: boolean } {
  const { user, isLoaded } = useUser();
  const isAdmin = !!user && ADMIN_USER_IDS.includes(user.id);
  return { isAdmin, isLoaded };
}
