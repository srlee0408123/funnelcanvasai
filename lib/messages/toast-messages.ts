/**
 * Toast Messages - 토스트 메시지 상수 모음
 * 
 * 주요 역할:
 * 1. 모든 토스트 메시지를 중앙화하여 일관성 확보
 * 2. 기능별/페이지별로 메시지 그룹화
 * 3. 다국어 지원을 위한 구조화된 메시지 관리
 * 
 * 핵심 특징:
 * - 사용자 친화적인 한국어 메시지
 * - 구체적인 해결 방법 제시
 * - 일관된 용어 사용
 * 
 * 주의사항:
 * - 메시지는 최대 50자 이내로 작성
 * - 기술적 용어보다는 사용자 친화적 표현 사용
 * - 해결 방법이나 다음 액션을 명확히 제시
 */

export interface ToastMessage {
  title: string;
  description: string;
}

// 공통 용어 정의
export const COMMON_TERMS = {
  SUCCESS: "완료",
  ERROR: "오류",
  WARNING: "주의",
  INFO: "안내",
  LOADING: "처리 중",
  RETRY: "다시 시도해주세요",
  CHECK_NETWORK: "인터넷 연결을 확인해주세요",
  CONTACT_SUPPORT: "문제가 지속되면 고객지원에 문의해주세요"
} as const;

// 1. 파일 업로드 관련 메시지
export const UPLOAD_MESSAGES = {
  // 성공 메시지
  SUCCESS: {
    PDF: {
      title: "PDF 업로드 완료",
      description: "PDF 파일이 성공적으로 업로드되었습니다."
    },
    YOUTUBE: {
      title: "YouTube 업로드 완료", 
      description: "YouTube 영상이 성공적으로 추가되었습니다."
    },
    WEBSITE: {
      title: "웹사이트 업로드 완료",
      description: "웹사이트 내용이 성공적으로 스크래핑되었습니다."
    }
  },
  
  // 에러 메시지
  ERROR: {
    FILE_SIZE: {
      title: "파일 크기 초과",
      description: "파일 크기는 10MB 이하여야 합니다. 더 작은 파일을 선택해주세요."
    },
    FILE_TYPE: {
      title: "파일 형식 오류",
      description: "PDF 파일만 업로드 가능합니다. PDF 형식의 파일을 선택해주세요."
    },
    INVALID_URL: {
      title: "URL 형식 오류",
      description: "올바른 URL을 입력해주세요. 예: https://example.com"
    },
    INVALID_YOUTUBE_URL: {
      title: "YouTube URL 오류",
      description: "올바른 YouTube URL을 입력해주세요. 예: https://youtube.com/watch?v=..."
    },
    DUPLICATE: {
      title: "중복 파일",
      description: "이미 업로드된 파일입니다. 다른 파일을 선택해주세요."
    },
    NETWORK: {
      title: "업로드 실패",
      description: `네트워크 오류로 업로드에 실패했습니다. ${COMMON_TERMS.CHECK_NETWORK}`
    },
    PROCESSING: {
      title: "처리 실패",
      description: `파일 처리 중 오류가 발생했습니다. ${COMMON_TERMS.RETRY}`
    },
    GENERAL: {
      title: "업로드 실패",
      description: `파일 업로드에 실패했습니다. ${COMMON_TERMS.RETRY}`
    }
  },

  // 경고 메시지
  WARNING: {
    LARGE_FILE: {
      title: "큰 파일 크기",
      description: "파일이 큽니다. 처리에 시간이 걸릴 수 있습니다. 잠시만 기다려주세요."
    }
  },

  // 정보 메시지
  INFO: {
    PROCESSING: {
      title: "파일 처리 중",
      description: "파일을 분석하고 있습니다. 잠시만 기다려주세요."
    }
  }
} as const;

// 2. 캔버스 관련 메시지
export const CANVAS_MESSAGES = {
  // 성공 메시지
  SUCCESS: {
    SAVE: {
      title: "저장 완료",
      description: "캔버스가 성공적으로 저장되었습니다."
    },
    TITLE_UPDATE: {
      title: "제목 변경 완료",
      description: "캔버스 제목이 변경되었습니다."
    },
    NODE_ADD: {
      title: "노드 추가됨",
      description: "새 노드가 캔버스에 추가되었습니다."
    },
    CREATE: {
      title: "캔버스 생성 완료",
      description: "새 캔버스가 생성되었습니다."
    },
    SHARE: {
      title: "공유 완료",
      description: "캔버스가 성공적으로 공유되었습니다."
    }
  },

  // 에러 메시지
  ERROR: {
    SAVE: {
      title: "저장 실패",
      description: `캔버스 저장 중 오류가 발생했습니다. ${COMMON_TERMS.RETRY}`
    },
    TITLE_UPDATE: {
      title: "제목 변경 실패",
      description: `제목 변경 중 오류가 발생했습니다. ${COMMON_TERMS.RETRY}`
    },
    CREATE: {
      title: "생성 실패",
      description: `캔버스 생성에 실패했습니다. ${COMMON_TERMS.RETRY}`
    },
    PERMISSION: {
      title: "권한 없음",
      description: "이 작업을 수행할 권한이 없습니다. 캔버스 소유자에게 문의하세요."
    },
    NOT_FOUND: {
      title: "캔버스를 찾을 수 없음",
      description: "요청한 캔버스가 존재하지 않습니다. 캔버스 목록에서 다시 선택해주세요."
    },
    NETWORK: {
      title: "연결 실패",
      description: `네트워크 오류로 작업에 실패했습니다. ${COMMON_TERMS.CHECK_NETWORK}`
    }
  },

  // 경고 메시지
  WARNING: {
    UNSAVED_CHANGES: {
      title: "저장되지 않은 변경사항",
      description: "변경사항이 저장되지 않았습니다. 저장 후 계속하시겠습니까?"
    }
  }
} as const;

// 3. AI 기능 관련 메시지
export const AI_MESSAGES = {
  // 성공 메시지
  SUCCESS: {
    ANALYSIS_COMPLETE: {
      title: "AI 분석 완료",
      description: "퍼널 분석이 완료되었습니다."
    },
    FEEDBACK_READY: {
      title: "피드백 준비 완료",
      description: "AI 개선 제안이 준비되었습니다."
    }
  },

  // 에러 메시지
  ERROR: {
    ANALYSIS_FAILED: {
      title: "AI 분석 실패",
      description: "AI 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
    },
    TIMEOUT: {
      title: "분석 시간 초과",
      description: "분석 시간이 너무 오래 걸립니다. 다시 시도해주세요."
    },
    QUOTA_EXCEEDED: {
      title: "사용량 초과",
      description: "AI 분석 일일 한도를 초과했습니다. 내일 다시 시도해주세요."
    },
    NETWORK: {
      title: "AI 서비스 연결 실패",
      description: `AI 서비스에 연결할 수 없습니다. ${COMMON_TERMS.CHECK_NETWORK}`
    }
  },

  // 정보 메시지
  INFO: {
    PROCESSING: {
      title: "AI 분석 중",
      description: "퍼널을 분석하고 있습니다. 잠시만 기다려주세요."
    },
    PREPARING: {
      title: "분석 준비 중",
      description: "AI 분석을 준비하고 있습니다."
    }
  }
} as const;

// 4. 인증 관련 메시지
export const AUTH_MESSAGES = {
  // 에러 메시지
  ERROR: {
    UNAUTHORIZED: {
      title: "로그인 필요",
      description: "로그인이 필요한 서비스입니다. 로그인 페이지로 이동합니다."
    },
    SESSION_EXPIRED: {
      title: "세션 만료",
      description: "로그인 세션이 만료되었습니다. 다시 로그인해주세요."
    },
    PERMISSION_DENIED: {
      title: "접근 권한 없음",
      description: "이 기능을 사용할 권한이 없습니다. 관리자에게 문의하세요."
    }
  },

  // 정보 메시지
  INFO: {
    LOGGING_OUT: {
      title: "로그아웃 중",
      description: "안전하게 로그아웃하고 있습니다."
    },
    REDIRECTING: {
      title: "페이지 이동 중",
      description: "로그인 페이지로 이동합니다."
    }
  }
} as const;

// 5. 폼 유효성 검사 관련 메시지
export const VALIDATION_MESSAGES = {
  ERROR: {
    REQUIRED_FIELD: {
      title: "필수 입력",
      description: "필수 항목을 입력해주세요."
    },
    INVALID_EMAIL: {
      title: "이메일 형식 오류",
      description: "올바른 이메일 주소를 입력해주세요. 예: user@example.com"
    },
    PASSWORD_TOO_SHORT: {
      title: "비밀번호 길이 부족",
      description: "비밀번호는 8자 이상이어야 합니다."
    },
    PASSWORDS_NOT_MATCH: {
      title: "비밀번호 불일치",
      description: "비밀번호가 일치하지 않습니다. 비밀번호를 다시 확인해주세요."
    }
  }
} as const;

// 6. 네트워크 관련 메시지
export const NETWORK_MESSAGES = {
  ERROR: {
    CONNECTION_FAILED: {
      title: "연결 실패",
      description: `서버에 연결할 수 없습니다. ${COMMON_TERMS.CHECK_NETWORK}`
    },
    TIMEOUT: {
      title: "요청 시간 초과",
      description: `서버 응답 시간이 초과되었습니다. ${COMMON_TERMS.RETRY}`
    },
    SERVER_ERROR: {
      title: "서버 오류",
      description: "서버에서 오류가 발생했습니다. 잠시 후 다시 시도하거나 고객지원에 문의하세요."
    }
  }
} as const;

// 전체 메시지 통합
export const TOAST_MESSAGES = {
  UPLOAD: UPLOAD_MESSAGES,
  CANVAS: CANVAS_MESSAGES,
  AI: AI_MESSAGES,
  AUTH: AUTH_MESSAGES,
  VALIDATION: VALIDATION_MESSAGES,
  NETWORK: NETWORK_MESSAGES
} as const;
