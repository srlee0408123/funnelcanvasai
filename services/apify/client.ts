import { ApifyClient } from 'apify-client';

/**
 * apify/client - Shared Apify client instance
 * 
 * 주요 역할:
 * 1. ApifyClient 단일 인스턴스 제공
 * 2. 공통 인증 토큰 관리 (APIFY_API_TOKEN)
 * 3. 모든 Apify 기반 서비스에서 재사용
 */

export const apifyClient = new ApifyClient({
  token: process.env.APIFY_API_TOKEN,
});


