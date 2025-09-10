"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/nextjs";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@shared/schema";

export function useAuth() {
  const { data: user, isLoading } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
  };
}

/**
 * 프로필 정보를 가져오는 커스텀 훅
 * 모든 페이지에서 일관된 프로필 정보 관리를 위해 사용
 */
export function useProfile() {
  const { data: profileData, isLoading, error } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const response = await fetch('/api/profile/phone', {
        method: 'GET',
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch profile');
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5분 캐시
    retry: 1, // 실패 시 1번만 재시도
  });

  // 실시간 프로필 변경 구독 → plan 등 변경 시 즉시 캐시 무효화/재조회
  const queryClient = useQueryClient();
  const { user } = useUser();
  useEffect(() => {
    if (!user?.id) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`profile-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['profile'] });
          queryClient.refetchQueries({ queryKey: ['profile'] }).catch(() => {});
        }
      )
      .subscribe();
    return () => {
      try { supabase.removeChannel(channel); } catch {}
    };
  }, [user?.id, queryClient]);

  // 프로필 정보를 ProfileBadge 형식으로 변환
  const profile = profileData ? {
    plan: profileData.plan || 'free',
    email: profileData.emailMasked || profileData.email,
  } : null;

  return {
    profile,
    isLoading,
    error,
    rawData: profileData,
  };
}
