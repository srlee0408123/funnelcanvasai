/**
 * storage.ts - 로컬 스토리지 관리 유틸리티
 * 
 * 주요 역할:
 * 1. 브라우저 로컬 스토리지 데이터 관리
 * 2. 캔버스 상태 및 사용자 설정 저장
 * 3. 타입 안전한 스토리지 인터페이스 제공
 * 
 * 핵심 특징:
 * - JSON 직렬화/역직렬화 자동 처리
 * - 타입 안전성을 위한 제네릭 인터페이스
 * - 에러 처리 및 기본값 지원
 * 
 * 주의사항:
 * - 서버 사이드에서는 사용 불가 (브라우저 전용)
 * - 스토리지 용량 제한 고려 필요
 * - 민감한 정보 저장 금지
 */

// 스토리지 키 상수 정의
export const STORAGE_KEYS = {
  CANVAS_STATE: 'canvas_state',
  USER_PREFERENCES: 'user_preferences',
  RECENT_CANVASES: 'recent_canvases',
  DRAFT_NODES: 'draft_nodes',
  CHAT_HISTORY: 'chat_history',
} as const;

// 스토리지 데이터 타입 정의
interface StorageData {
  [STORAGE_KEYS.CANVAS_STATE]: {
    canvasId: string;
    nodes: any[];
    edges: any[];
    viewport: { x: number; y: number; zoom: number };
    lastSaved: string;
  };
  [STORAGE_KEYS.USER_PREFERENCES]: {
    theme: 'light' | 'dark' | 'system';
    language: 'ko' | 'en';
    autoSave: boolean;
    notifications: boolean;
  };
  [STORAGE_KEYS.RECENT_CANVASES]: {
    id: string;
    title: string;
    lastAccessed: string;
  }[];
  [STORAGE_KEYS.DRAFT_NODES]: {
    [canvasId: string]: any[];
  };
  [STORAGE_KEYS.CHAT_HISTORY]: {
    [canvasId: string]: {
      id: string;
      message: string;
      role: 'user' | 'assistant';
      timestamp: string;
    }[];
  };
}

class Storage {
  /**
   * 로컬 스토리지 사용 가능 여부 확인
   */
  private isStorageAvailable(): boolean {
    if (typeof window === 'undefined') return false;
    
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 데이터를 로컬 스토리지에 저장
   */
  setItem<K extends keyof StorageData>(
    key: K,
    value: StorageData[K]
  ): boolean {
    if (!this.isStorageAvailable()) {
      console.warn('로컬 스토리지를 사용할 수 없습니다.');
      return false;
    }

    try {
      const serializedValue = JSON.stringify(value);
      localStorage.setItem(key, serializedValue);
      return true;
    } catch (error) {
      console.error('스토리지 저장 실패:', error);
      return false;
    }
  }

  /**
   * 로컬 스토리지에서 데이터 조회
   */
  getItem<K extends keyof StorageData>(
    key: K
  ): StorageData[K] | null {
    if (!this.isStorageAvailable()) {
      return null;
    }

    try {
      const item = localStorage.getItem(key);
      if (item === null) return null;
      
      return JSON.parse(item) as StorageData[K];
    } catch (error) {
      console.error('스토리지 조회 실패:', error);
      return null;
    }
  }

  /**
   * 기본값과 함께 데이터 조회
   */
  getItemWithDefault<K extends keyof StorageData>(
    key: K,
    defaultValue: StorageData[K]
  ): StorageData[K] {
    const value = this.getItem(key);
    return value !== null ? value : defaultValue;
  }

  /**
   * 로컬 스토리지에서 데이터 삭제
   */
  removeItem<K extends keyof StorageData>(key: K): boolean {
    if (!this.isStorageAvailable()) {
      return false;
    }

    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error('스토리지 삭제 실패:', error);
      return false;
    }
  }

  /**
   * 모든 스토리지 데이터 삭제
   */
  clear(): boolean {
    if (!this.isStorageAvailable()) {
      return false;
    }

    try {
      // 앱 관련 키만 삭제 (다른 앱의 데이터는 보존)
      Object.values(STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key);
      });
      return true;
    } catch (error) {
      console.error('스토리지 전체 삭제 실패:', error);
      return false;
    }
  }

  /**
   * 스토리지 용량 확인 (대략적)
   */
  getStorageSize(): number {
    if (!this.isStorageAvailable()) {
      return 0;
    }

    let totalSize = 0;
    Object.values(STORAGE_KEYS).forEach(key => {
      const item = localStorage.getItem(key);
      if (item) {
        totalSize += item.length;
      }
    });

    return totalSize;
  }
}

// 싱글톤 인스턴스 생성 및 내보내기
export const storage = new Storage();

// 편의를 위한 개별 함수들도 내보내기
export const setStorageItem = storage.setItem.bind(storage);
export const getStorageItem = storage.getItem.bind(storage);
export const getStorageItemWithDefault = storage.getItemWithDefault.bind(storage);
export const removeStorageItem = storage.removeItem.bind(storage);
export const clearStorage = storage.clear.bind(storage);
