import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const session = {
  access_token: "access-token",
  refresh_token: "refresh-token",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: "bearer",
  user: {
    id: "user-1",
    aud: "authenticated",
    email: "researcher@example.com",
    app_metadata: {},
    user_metadata: {},
    created_at: "2026-01-01T00:00:00.000Z",
  },
};

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signInWithPassword: vi.fn(),
  updateUser: vi.fn(),
  unsubscribe: vi.fn(),
}));

vi.mock("@/auth/supabase-client", () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
      onAuthStateChange: mocks.onAuthStateChange,
      signInWithPassword: mocks.signInWithPassword,
      updateUser: mocks.updateUser,
    },
  },
}));

import { AppAuthProvider, useAuth } from "@/auth/auth-provider";

describe("AppAuthProvider password changes", () => {
  beforeEach(() => {
    mocks.getSession.mockReset().mockResolvedValue({
      data: { session },
      error: null,
    });
    mocks.onAuthStateChange.mockReset().mockReturnValue({
      data: { subscription: { unsubscribe: mocks.unsubscribe } },
    });
    mocks.signInWithPassword.mockReset().mockResolvedValue({
      data: { session, user: session.user },
      error: null,
    });
    mocks.updateUser.mockReset().mockResolvedValue({
      data: { user: session.user },
      error: null,
    });
  });

  function wrapper({ children }: { children: ReactNode }) {
    return <AppAuthProvider>{children}</AppAuthProvider>;
  }

  it("verifies the current password before updating to the new password", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(() => result.current.verifyCurrentPassword("current-password"));
    await act(() => result.current.updatePassword("new-secure-password"));

    expect(mocks.signInWithPassword).toHaveBeenCalledWith({
      email: "researcher@example.com",
      password: "current-password",
    });
    expect(mocks.updateUser).toHaveBeenCalledWith({
      password: "new-secure-password",
    });
    expect(mocks.signInWithPassword.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.updateUser.mock.invocationCallOrder[0]!,
    );
  });
});
