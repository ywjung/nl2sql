# Natural Language to SQL Application

이 프로젝트는 자연어 쿼리를 SQL 문으로 변환하는 애플리케이션입니다. 사용자는 자연어로 질문을 입력하고, 애플리케이션은 이를 분석하여 해당 SQL 쿼리를 생성하고 실행합니다.

## 프로젝트 구조

- `nl-to-sql-app/`: Next.js 기반의 메인 애플리케이션 디렉토리
  - `src/app/`: Next.js 앱 라우터 구조
    - `api/`: API 라우트 (LLM 및 데이터베이스 관련 엔드포인트)
    - `components/`: React 컴포넌트
    - `lib/`: 유틸리티 함수 및 라이브러리
  - `public/`: 정적 파일
- `README.md`: 프로젝트 개요 및 설정 가이드 (현재 파일)

## 시작하기

### 전제 조건

- Node.js (버전 18 이상 권장)
- npm 또는 yarn
- 데이터베이스 (예: PostgreSQL, MySQL, SQLite)

### 설치

1. 저장소를 클론합니다:

   ```bash
   git clone [저장소 URL]
   cd nl2sql
   ```

2. `nl-to-sql-app` 디렉토리로 이동하여 종속성을 설치합니다:

   ```bash
   cd nl-to-sql-app
   npm install
   # 또는 yarn install
   ```

3. 환경 변수를 설정합니다. `.env.example` 파일을 복사하여 `.env.local` 파일을 생성하고 필요한 환경 변수를 채웁니다.
   ```bash
   cp .env.example .env.local
   ```
   `.env.local` 파일 예시:
   ```
   DATABASE_URL="your_database_connection_string"
   OPENAI_API_KEY="your_openai_api_key"
   ```

### 애플리케이션 실행

개발 서버를 시작합니다:

```bash
npm run dev
# 또는 yarn dev
```

애플리케이션은 `http://localhost:3000`에서 실행됩니다.

## 사용법

1. 애플리케이션에 접속하여 데이터베이스 연결 정보를 설정합니다.
2. 자연어 쿼리를 입력 필드에 입력합니다.
3. "SQL 생성" 버튼을 클릭하여 자연어 쿼리를 SQL로 변환합니다.
4. 생성된 SQL 쿼리를 검토하고 "실행" 버튼을 클릭하여 데이터베이스에서 쿼리를 실행합니다.

## API 엔드포인트

- `/api/llm`: 자연어 쿼리를 SQL로 변환하는 LLM 관련 API
- `/api/db/connect`: 데이터베이스 연결
- `/api/db/schema`: 데이터베이스 스키마 정보 가져오기
- `/api/db/tables`: 데이터베이스 테이블 목록 가져오기
- `/api/db/analyze`: SQL 쿼리 분석
- `/api/db/execute`: SQL 쿼리 실행

## 기여

기여에 대한 내용은 `CONTRIBUTING.md` 파일을 참조하십시오 (아직 없는 경우 생성 예정).

## 라이선스

이 프로젝트는 [라이선스 유형] 라이선스에 따라 배포됩니다. 자세한 내용은 `LICENSE` 파일을 참조하십시오 (아직 없는 경우 생성 예정).
