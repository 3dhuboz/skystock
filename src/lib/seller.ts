import { useUser } from '@clerk/clerk-react';

/**
 * Seller role — users who've applied via /seller/apply and been approved by
 * an admin. We trust the backend to be authoritative (admin/moderation
 * endpoints re-check). The hook here is just for UI gating.
 *
 * Backend: `sellers.approved = 1` for this Clerk user id.
 * Client cache: Clerk public metadata `role: 'seller'` once approved, so we
 *   can decide to show /seller/* without a D1 roundtrip on every page.
 */
export function useIsSeller(): { isSeller: boolean; hasApplied: boolean; isLoaded: boolean } {
  const { user, isLoaded } = useUser();
  const role = (user?.publicMetadata as Record<string, unknown> | undefined)?.role;
  const isSeller = role === 'seller' || role === 'admin';
  const hasApplied = !!(user?.publicMetadata as Record<string, unknown> | undefined)?.sellerApplied;
  return { isSeller, hasApplied, isLoaded };
}

/** Endpoint base — seller API is public-facing for the seller themselves,
 *  but each request includes the Clerk bearer and the backend enforces
 *  seller ownership. */
export const SELLER_API = '/api/seller';
