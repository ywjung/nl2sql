# Natural Language to SQL Application

## 1. 개요

이 프로젝트는 자연어 쿼리를 자동으로 SQL 문으로 변환하는 웹 애플리케이션입니다. 자연어 처리(NLP) 기술과 데이터베이스 API를 결합하여 사용자가 직관적인 언어로 데이터베이스 질의를 수행할 수 있도록 설계되었습니다. 주요 기능으로는:

- 실시간 SQL 쿼리 생성
- 다양한 데이터베이스 플랫폼(PostgreSQL, MySQL, SQLite 등) 호환
- LLM(LLM)을 통한 의미 분석
- 데이터베이스 연결 및 쿼리 실행

## 2. 기술 스택

- 프론트엔드: Next.js, React, Tailwind CSS
- 백엔드: API 라우트(Next.js App Router 기반)
- 데이터베이스: PostgreSQL, MySQL, SQLite (템플릿)
- NLP: OpenAI GPT API (사용자 제공 API 키 기반)

## 3. 디렉토리 구조

```
nl-to-sql-app/
├── src/
│   ├── app/                # Next.js 앱 루트
│   │   ├── api/            # API 라우트 (HTTP 엔드포인트)
│   │   │   ├── db/         # 데이터베이스 연동 API
│   │   │   │   ├── analyze/     # 쿼리 분석 API
│   │   │   │   ├── connect/     # 데이터베이스 연결 API
│   │   │   │   ├── execute/     # 쿼리 실행 API
│   │   │   │   ├── schema/      # 스키마 정보 가져오기 API
│   │   │   │   └── tables/      # 테이블 목록 가져오기 API
│   │   │   ├── components/     # UI 컴포넌트
│   │   │   │   └── NaturalLanguageToSQL.js  # 메인 인터페이스
│   │   │   └── lib/            # 유틸리티 라이브러리
│   │   │       └── db.js      # 데이터베이스 연결 및 쿼리 실행 유틸리티
│   │   └── public/           # 정적 파일 (아이콘, 이미지 등)
│   └── app.config.ts         # 애플리케이션 설정
└── .env.example              # 환경 변수 템플릿
```

## 4. 설치 가이드

### 4.1 시스템 요구사항

- Node.js v18 이상
- npm 또는 yarn
- 데이터베이스 서버 (PostgreSQL, MySQL, SQLite 중 선택)

### 4.2 설치 단계

1. 저장소 복제:

```bash
git clone [저장소 URL]
cd nl-to-sql-app
```

2. 종속성 설치:

```bash
npm install
# 또는 yarn install
```

3. 환경 변수 설정:

```bash
cp .env.example .env.local
```

`.env.local` 파일 예시:

```env
DATABASE_URL="postgres://user:password@localhost:5432/mydb"
OPENAI_API_KEY="your-openai-api-key"
```

## 5. 실행 방법

### 5.1 개발 서버 실행

```bash
npm run dev
# 또는 yarn dev
```

애플리케이션은 `http://localhost:3000`에서 실행됩니다.

### 5.2 데이터베이스 연결

1. 애플리케이션에 접속합니다.
2. "데이터베이스 연결" 섹션에서 `DATABASE_URL`을 입력합니다.
3. "연결 확인" 버튼을 클릭하여 연결 상태를 검증합니다.

## 6. 주요 API 엔드포인트

### 6.1 LLM 기반 쿼리 생성

- **URL**: `/api/llm`
- **메서드**: POST
- **요청 본문 예시**:

```json
{
  "query": "Please show me the total sales in June"
}
```

- **응답 본문 예시**:

```json
{
  "sql": "SELECT SUM(total) FROM sales WHERE MONTH(date) = 6;",
  "confidence": 0.95
}
```

### 6.2 데이터베이스 쿼리 실행

- **URL**: `/api/db/execute`
- **메서드**: POST
- **요청 본문 예시**:

```json
{
  "sql": "SELECT * FROM customers WHERE country = 'USA';"
}
```

- **응답 본문 예시**:

```json
{
  "results": [
    { "id": 1, "name": "John Doe", "country": "USA" },
    { "id": 2, "name": "Jane Smith", "country": "USA" }
  ]
}
```

## 7. 기여 가이드

### 7.1 코드 스타일

- ESLint를 이용한 정적 분석 (`.eslint.config.mjs` 참고)
- Prettier로 포맷팅
- 함수명: `snake_case`
- 변수명: `camelCase`

### 7.2 테스트

- Jest 기반의 단위 테스트 (테스트 파일은 `src/app/__tests__`에 위치)
- 데이터베이스 연동 테스트를 위한 `setupTestDatabase()` 함수 제공

### 7.3 Pull Request

1. 개발 브랜치에서 작업합니다.
2. 테스트를 통과한 후 PR을 생성합니다.
3. 코드 리뷰 후 메인 브랜치에 병합됩니다.

## 8. 라이선스

이 프로젝트는 APACHE 2.0 License 하에 배포됩니다. 자세한 내용은 `LICENSE` 파일을 참조하십시오.

## 9. 문제 해결

- **연결 오류**: `.env.local` 파일의 `DATABASE_URL` 확인
- **LLM API 오류**: OpenAI API 키 재확인
- **쿼리 실행 실패**: SQL 구문 검토

## 10. 추가 정보

- 문서: `docs/` 디렉토리 (아직 비어있음)
- 이슈 추적: GitHub Issues
- 버전 관리: Git

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

## 라이선스

APACHE 2.0
