/**
 * Messages - 토스트 메시지 시스템 통합 인덱스
 * 
 * 주요 역할:
 * 1. 토스트 메시지 상수와 유틸리티 함수 통합 export
 * 2. 편리한 import를 위한 단일 진입점 제공
 * 3. 메시지 시스템의 일관된 사용 패턴 제공
 * 
 * 사용 예시:
 * import { createToastMessage, TOAST_MESSAGES } from '@/lib/messages';
 */

// 토스트 메시지 상수
export * from './toast-messages';

// 토스트 유틸리티 함수
export * from './toast-utils';

// 편의를 위한 기본 export
export { createToastMessage as default } from './toast-utils';
