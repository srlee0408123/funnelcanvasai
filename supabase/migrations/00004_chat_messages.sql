-- 채팅 메시지 테이블 생성 (이미 스키마에 정의되어 있지만 마이그레이션 확인용)

-- 채팅 메시지 테이블이 없다면 생성
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canvas_id UUID NOT NULL REFERENCES canvases(id) ON DELETE CASCADE,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS chat_messages_canvas_id_idx ON chat_messages(canvas_id);
CREATE INDEX IF NOT EXISTS chat_messages_created_at_idx ON chat_messages(created_at);
CREATE INDEX IF NOT EXISTS chat_messages_user_id_idx ON chat_messages(user_id);

-- RLS (Row Level Security) 비활성화 - API 라우터에서 권한 검증 수행
ALTER TABLE chat_messages DISABLE ROW LEVEL SECURITY;

-- 실시간 구독 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
