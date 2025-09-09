import { useQuery } from "@tanstack/react-query";
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
