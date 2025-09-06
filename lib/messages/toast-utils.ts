/**
 * Toast Utils - 토스트 메시지 유틸리티 함수들
 * 
 * 주요 역할:
 * 1. 토스트 메시지를 쉽게 호출할 수 있는 헬퍼 함수 제공
 * 2. 에러 타입에 따른 자동 메시지 선택
 * 3. 일관된 토스트 호출 패턴 제공
 * 
 * 핵심 특징:
 * - 타입 안전성을 보장하는 메시지 선택
 * - 에러 객체에서 자동으로 적절한 메시지 추출
 * - 커스텀 메시지와 기본 메시지 조합 지원
 * 
 * 주의사항:
 * - useToast 훅과 함께 사용해야 함
 * - 에러 타입 판별 로직은 확장 가능하도록 설계
 */

import { TOAST_MESSAGES } from './toast-messages';

export type ToastVariant = 'default' | 'destructive';

export interface ToastOptions {
  title: string;
  description: string;
  variant?: ToastVariant;
  duration?: number;
}

// 에러 타입 판별 함수들
export const ErrorDetectors = {
  isUnauthorizedError: (error: unknown): boolean => {
    const message = error instanceof Error ? error.message : String(error);
    return /401|unauthorized|로그인|login/i.test(message);
  },

  isNetworkError: (error: unknown): boolean => {
    const message = error instanceof Error ? error.message : String(error);
    return /network|fetch|connection|timeout|연결/i.test(message);
  },

  isValidationError: (error: unknown): boolean => {
    const message = error instanceof Error ? error.message : String(error);
    return /validation|invalid|required|형식|필수/i.test(message);
  },

  isPermissionError: (error: unknown): boolean => {
    const message = error instanceof Error ? error.message : String(error);
    return /403|forbidden|permission|권한/i.test(message);
  },

  isNotFoundError: (error: unknown): boolean => {
    const message = error instanceof Error ? error.message : String(error);
    return /404|not found|찾을 수 없/i.test(message);
  },

  isServerError: (error: unknown): boolean => {
    const message = error instanceof Error ? error.message : String(error);
    return /500|server error|서버 오류/i.test(message);
  },

  isDuplicateError: (error: unknown): boolean => {
    const message = error instanceof Error ? error.message : String(error);
    return /409|duplicate|중복/i.test(message);
  }
};

// 토스트 메시지 생성 헬퍼 함수들
export class ToastMessageBuilder {
  /**
   * 업로드 성공 메시지 생성
   */
  static uploadSuccess(type: 'PDF' | 'YOUTUBE' | 'WEBSITE'): ToastOptions {
    const message = TOAST_MESSAGES.UPLOAD.SUCCESS[type];
    return {
      ...message,
      variant: 'default'
    };
  }

  /**
   * 업로드 에러 메시지 생성
   */
  static uploadError(error: unknown, fileType?: string): ToastOptions {
    if (ErrorDetectors.isDuplicateError(error)) {
      return {
        ...TOAST_MESSAGES.UPLOAD.ERROR.DUPLICATE,
        variant: 'destructive'
      };
    }

    if (ErrorDetectors.isNetworkError(error)) {
      return {
        ...TOAST_MESSAGES.UPLOAD.ERROR.NETWORK,
        variant: 'destructive'
      };
    }

    // 파일 타입별 기본 에러 메시지
    return {
      ...TOAST_MESSAGES.UPLOAD.ERROR.GENERAL,
      variant: 'destructive'
    };
  }

  /**
   * 파일 유효성 검사 에러 메시지 생성
   */
  static fileValidationError(type: 'SIZE' | 'TYPE' | 'URL' | 'YOUTUBE_URL'): ToastOptions {
    const errorKey = type === 'SIZE' ? 'FILE_SIZE' :
                     type === 'TYPE' ? 'FILE_TYPE' :
                     type === 'URL' ? 'INVALID_URL' :
                     'INVALID_YOUTUBE_URL';
    
    return {
      ...TOAST_MESSAGES.UPLOAD.ERROR[errorKey],
      variant: 'destructive'
    };
  }

  /**
   * 캔버스 성공 메시지 생성
   */
  static canvasSuccess(type: 'SAVE' | 'TITLE_UPDATE' | 'NODE_ADD' | 'CREATE' | 'SHARE', customTitle?: string): ToastOptions {
    const message = TOAST_MESSAGES.CANVAS.SUCCESS[type];
    
    if (type === 'TITLE_UPDATE' && customTitle) {
      return {
        title: message.title,
        description: `"${customTitle}"으로 변경되었습니다.`,
        variant: 'default'
      };
    }

    if (type === 'NODE_ADD' && customTitle) {
      return {
        title: message.title,
        description: `${customTitle} 노드가 캔버스에 추가되었습니다.`,
        variant: 'default'
      };
    }

    return {
      ...message,
      variant: 'default'
    };
  }

  /**
   * 캔버스 에러 메시지 생성
   */
  static canvasError(error: unknown, operation?: 'SAVE' | 'CREATE' | 'UPDATE'): ToastOptions {
    if (ErrorDetectors.isUnauthorizedError(error)) {
      return {
        ...TOAST_MESSAGES.AUTH.ERROR.UNAUTHORIZED,
        variant: 'destructive'
      };
    }

    if (ErrorDetectors.isPermissionError(error)) {
      return {
        ...TOAST_MESSAGES.CANVAS.ERROR.PERMISSION,
        variant: 'destructive'
      };
    }

    if (ErrorDetectors.isNotFoundError(error)) {
      return {
        ...TOAST_MESSAGES.CANVAS.ERROR.NOT_FOUND,
        variant: 'destructive'
      };
    }

    if (ErrorDetectors.isNetworkError(error)) {
      return {
        ...TOAST_MESSAGES.CANVAS.ERROR.NETWORK,
        variant: 'destructive'
      };
    }

    // 작업별 기본 에러 메시지
    const errorKey = operation === 'SAVE' ? 'SAVE' :
                     operation === 'CREATE' ? 'CREATE' :
                     operation === 'UPDATE' ? 'TITLE_UPDATE' :
                     'SAVE';

    return {
      ...TOAST_MESSAGES.CANVAS.ERROR[errorKey],
      variant: 'destructive'
    };
  }

  /**
   * AI 기능 메시지 생성
   */
  static aiMessage(type: 'SUCCESS' | 'ERROR' | 'INFO', subType: string): ToastOptions {
    const messageGroup = TOAST_MESSAGES.AI[type];
    const message = (messageGroup as any)[subType];
    
    if (!message) {
      return {
        title: 'AI 서비스',
        description: 'AI 서비스 처리 중입니다.',
        variant: type === 'ERROR' ? 'destructive' : 'default'
      };
    }

    return {
      ...message,
      variant: type === 'ERROR' ? 'destructive' : 'default'
    };
  }

  /**
   * 인증 에러 메시지 생성
   */
  static authError(error: unknown): ToastOptions {
    if (ErrorDetectors.isUnauthorizedError(error)) {
      return {
        ...TOAST_MESSAGES.AUTH.ERROR.UNAUTHORIZED,
        variant: 'destructive'
      };
    }

    if (ErrorDetectors.isPermissionError(error)) {
      return {
        ...TOAST_MESSAGES.AUTH.ERROR.PERMISSION_DENIED,
        variant: 'destructive'
      };
    }

    return {
      ...TOAST_MESSAGES.AUTH.ERROR.SESSION_EXPIRED,
      variant: 'destructive'
    };
  }

  /**
   * 폼 유효성 검사 에러 메시지 생성
   */
  static validationError(field: string, type: 'REQUIRED' | 'EMAIL' | 'PASSWORD' | 'MATCH'): ToastOptions {
    const errorKey = type === 'REQUIRED' ? 'REQUIRED_FIELD' :
                     type === 'EMAIL' ? 'INVALID_EMAIL' :
                     type === 'PASSWORD' ? 'PASSWORD_TOO_SHORT' :
                     'PASSWORDS_NOT_MATCH';

    const message = TOAST_MESSAGES.VALIDATION.ERROR[errorKey];
    
    if (type === 'REQUIRED') {
      return {
        title: message.title,
        description: `${field}을(를) 입력해주세요.`,
        variant: 'destructive'
      };
    }

    return {
      ...message,
      variant: 'destructive'
    };
  }

  /**
   * 네트워크 에러 메시지 생성
   */
  static networkError(error: unknown): ToastOptions {
    const message = error instanceof Error ? error.message : String(error);

    if (/timeout/i.test(message)) {
      return {
        ...TOAST_MESSAGES.NETWORK.ERROR.TIMEOUT,
        variant: 'destructive'
      };
    }

    if (/500|server/i.test(message)) {
      return {
        ...TOAST_MESSAGES.NETWORK.ERROR.SERVER_ERROR,
        variant: 'destructive'
      };
    }

    return {
      ...TOAST_MESSAGES.NETWORK.ERROR.CONNECTION_FAILED,
      variant: 'destructive'
    };
  }

  /**
   * 커스텀 메시지 생성
   */
  static custom(title: string, description: string, variant: ToastVariant = 'default', action?: string): ToastOptions {
    const finalDescription = action ? `${description} ${action}` : description;
    return {
      title,
      description: finalDescription,
      variant
    };
  }
}

// 편의 함수들
export const createToastMessage = {
  // 업로드 관련
  uploadSuccess: ToastMessageBuilder.uploadSuccess,
  uploadError: ToastMessageBuilder.uploadError,
  fileValidationError: ToastMessageBuilder.fileValidationError,

  // 캔버스 관련
  canvasSuccess: ToastMessageBuilder.canvasSuccess,
  canvasError: ToastMessageBuilder.canvasError,

  // AI 관련
  aiMessage: ToastMessageBuilder.aiMessage,

  // 인증 관련
  authError: ToastMessageBuilder.authError,

  // 유효성 검사 관련
  validationError: ToastMessageBuilder.validationError,

  // 네트워크 관련
  networkError: ToastMessageBuilder.networkError,

  // 커스텀
  custom: ToastMessageBuilder.custom
};

// 자동 에러 메시지 선택 함수
export function getErrorMessage(error: unknown, context?: string): ToastOptions {
  // 인증 에러 우선 확인
  if (ErrorDetectors.isUnauthorizedError(error)) {
    return ToastMessageBuilder.authError(error);
  }

  // 네트워크 에러 확인
  if (ErrorDetectors.isNetworkError(error)) {
    return ToastMessageBuilder.networkError(error);
  }

  // 컨텍스트별 에러 처리
  if (context === 'upload') {
    return ToastMessageBuilder.uploadError(error);
  }

  if (context === 'canvas') {
    return ToastMessageBuilder.canvasError(error);
  }

  // 기본 에러 메시지
  const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
  return {
    title: '오류 발생',
    description: `${errorMessage} 다시 시도해주세요.`,
    variant: 'destructive'
  };
}
