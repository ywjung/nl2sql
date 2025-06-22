import { NextResponse } from "next/server";
import { getDb, setDbConfig } from "../../../lib/db";

// 데이터베이스 설정을 임시로 저장할 변수 (실제 프로덕션에서는 세션 또는 다른 저장소 사용 권장)
let tempDbConfig = null;

export async function POST(request) {
  const body = await request.json();
  const { sql, dbConfig } = body;

  if (!sql) {
    return NextResponse.json(
      { success: false, message: "SQL 쿼리가 필요합니다." },
      { status: 400 }
    );
  }

  // 요청 본문에 dbConfig가 있으면 업데이트
  if (dbConfig) {
    tempDbConfig = dbConfig;
  }

  if (!tempDbConfig) {
    return NextResponse.json(
      { success: false, message: "데이터베이스 구성이 설정되지 않았습니다." },
      { status: 400 }
    );
  }

  try {
    setDbConfig(tempDbConfig);
    const db = await getDb();

    // EXPLAIN ANALYZE 실행 (테이블 검증 생략)
    const explainQuery = `EXPLAIN (FORMAT JSON) ${sql}`;
    const explainResult = await db.query(explainQuery);
    const explainPlan = explainResult.rows[0]["QUERY PLAN"];

    // 환경변수에서 설정값 가져오기
    const LLM_PROVIDER = process.env.LLM || "LOCAL";
    const MODEL_NAME = process.env.MODEL || "qwen3-30b-a3b-mlx";
    const LM_STUDIO_URL = process.env.LM_STUDIO_URL || "http://localhost:1234";
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    const GEMINI_URL =
      process.env.GEMINI_URL ||
      "https://generativelanguage.googleapis.com/v1beta/models";

    // Gemini 모델 사용 여부 판단
    const isGemini =
      LLM_PROVIDER === "GEMINI" || MODEL_NAME.startsWith("gemini");
    const actualModel =
      isGemini && MODEL_NAME.startsWith("gemini")
        ? MODEL_NAME
        : isGemini
        ? "gemini-2.0-flash-exp"
        : MODEL_NAME;

    // AI에게 분석 요청 (한글 시스템 프롬프트로 수정)
    const systemPrompt = `당신은 '쿼리센트리(QuerySentry)'라는 이름의 세계 최고 수준의 PostgreSQL 성능 튜닝 전문가입니다. 사용자의 쿼리에 대한 'EXPLAIN' JSON 출력을 분석하고, 실행 가능하고 이해하기 쉬운 최적화 조언을 한글로 제공하는 것이 당신의 임무입니다. 항상 도움이 되고, 전문적이며, 격려하는 톤으로 답변해주세요.

### 응답 형식 (필수)
당신의 응답은 반드시 다음 형식이어야 합니다: \`<think>...</think><analysis>...</analysis>\`

### 핵심 지침
1.  **사고 과정 (<think> 태그 안에):** 쿼리 계획을 단계별로 검토하세요:
    - 쿼리 구조와 실행 경로 파악
    - 가장 비용이 많이 드는 작업과 그 비용 확인
    - 조인 전략, 스캔 유형, 필터링 작업 분석
    - 잠재적인 최적화 기회 고려

2.  **분석 결과 (<analysis> 태그 안에):** 실행 가능한 권장사항 제공:
    - **순차 스캔 (\`Seq Scan\`):** 특히 많은 행이 있는 테이블에서 필터링되는 경우. 이것이 최우선 순위입니다.
    - **중첩 루프 (\`Nested Loop\`):** 특히 내부 루프가 비용이 많이 드는 스캔인 경우.
    - **높은 비용:** \`total_cost\`가 높은 노드들.

3.  **실행 가능한 권장사항:** 조언은 구체적이고 실용적이어야 합니다.
    - **'Seq Scan'의 경우:** 필터가 적용된다면, 항상 필터링되는 컬럼에 인덱스 생성을 권장하세요. 정확한 \`CREATE INDEX\` 문을 제공하세요. 왜 도움이 되는지 설명하세요 (예: "B-Tree 인덱스는 특정 값을 빠르게 찾는 데 매우 효율적입니다.").
    - **조인의 경우:** 조인이 비효율적으로 보이면, 조인 키 컬럼에 인덱스가 존재하는지 확인하도록 제안하세요.

4.  **분석 결과 형식 (엄격함):**
    - 전체 쿼리 성능에 대한 한 문장 요약으로 시작
    - 권장사항은 불릿 리스트 (\`-\`) 사용
    - 모든 SQL 코드, 테이블명, 컬럼명은 백틱으로 감싸기 (예: \`CREATE INDEX ...\`, \`users\`, \`user_id\`)
    - 비전문가도 이해할 수 있도록 간결하고 명확한 설명
    - 격려하는 마무리 문장으로 끝내기

### 예시
**[당신의 응답]**
<think>
이 쿼리 계획을 살펴보니:
1. author_id 필터 조건이 있는 posts 테이블에 대한 Seq Scan이 있습니다
2. 총 비용이 1234.56으로 상당히 높습니다
3. 필터가 10000개 행을 약 100개로 줄이고 있습니다
4. 이는 author_id에 인덱스가 있으면 매우 유익할 것임을 시사합니다
5. 순차 스캔이 여기서 주요 병목지점입니다
</think>

<analysis>
쿼리 실행 계획을 분석한 결과, 한 가지 주요 성능 개선 지점을 발견했습니다.

- **인덱스 추천:** \`posts\` 테이블에 대한 순차 스캔(Seq Scan)이 확인되었습니다. 필터링에 사용되는 \`author_id\` 컬럼에 인덱스를 생성하면 성능을 크게 향상시킬 수 있습니다.
  - **추천 명령어:** \`CREATE INDEX idx_posts_author_id ON posts(author_id);\`
  - **설명:** 이 인덱스는 데이터베이스가 특정 작성자의 게시물을 찾기 위해 전체 테이블을 읽는 대신, 인덱스를 통해 원하는 데이터의 위치로 바로 이동할 수 있게 해줍니다.

이 권장 사항을 적용하여 쿼리 성능을 개선해 보세요!
</analysis>

**중요:** 반드시 모든 응답을 한글로 작성해주세요. 기술적인 용어나 SQL 명령어를 제외하고는 모든 설명과 분석을 한국어로 제공해주세요.`;

    const userMessage = `**Original SQL Query:**\n\`\`\`sql\n${sql}\n\`\`\`\n\n**EXPLAIN (FORMAT JSON) Output:**\n\`\`\`json\n${JSON.stringify(
      explainPlan,
      null,
      2
    )}\n\`\`\``;

    let response;
    let fullResponse;

    if (isGemini) {
      // Gemini API 호출
      if (!GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY가 설정되지 않았습니다.");
      }

      const geminiPayload = {
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `${systemPrompt}\n\n${userMessage}`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 4096,
          topP: 0.8,
          topK: 40,
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_NONE",
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH",
            threshold: "BLOCK_NONE",
          },
          {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_NONE",
          },
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_NONE",
          },
        ],
      };

      const geminiUrl = `${GEMINI_URL}/${actualModel}:generateContent?key=${GEMINI_API_KEY}`;

      response = await fetch(geminiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(geminiPayload),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(
          `Gemini API 요청 실패 (상태 코드: ${response.status}): ${errorBody}`
        );
      }

      const geminiData = await response.json();

      if (geminiData.error) {
        throw new Error(`Gemini API 오류: ${geminiData.error.message}`);
      }

      fullResponse =
        geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";

      if (!fullResponse) {
        throw new Error("Gemini API로부터 유효한 응답을 받지 못했습니다.");
      }
    } else {
      // LM Studio API 호출
      const payload = {
        model: actualModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `${userMessage}` },
        ],
        temperature: 0.1,
        max_tokens: -1,
        stream: false,
      };

      response = await fetch(`${LM_STUDIO_URL}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(
          `LM Studio API 요청 실패 (상태 코드: ${response.status}): ${errorBody}`
        );
      }

      const completion = await response.json();
      fullResponse = completion.choices[0].message.content;
    }

    // thinking과 analysis 부분 분리
    const thinkingMatch = fullResponse.match(/<think>(.*?)(?:<\/think>|$)/s);
    const analysisMatch = fullResponse.match(
      /<analysis>(.*?)(?:<\/analysis>|$)/s
    );

    const thinking = thinkingMatch ? thinkingMatch[1].trim() : "";
    const analysis = analysisMatch ? analysisMatch[1].trim() : fullResponse;

    return NextResponse.json({
      success: true,
      analysis,
      thinking: thinking || null, // thinking이 있을 때만 포함
    });
  } catch (error) {
    console.error("Performance analysis error:", error);

    // 테이블 존재 오류인 경우 특별한 처리
    if (error.code === "42P01") {
      return NextResponse.json({
        success: true,
        analysis: `**테이블 존재 오류 발견**

❌ **오류:** SQL 쿼리에서 참조하는 테이블이 현재 데이터베이스에 존재하지 않습니다.

**상세 정보:**
- **오류 코드:** ${error.code}
- **오류 메시지:** ${error.message}
- **위치:** ${error.position ? `문자 위치 ${error.position}` : "정보 없음"}

**해결 방법:**
1. **테이블 이름 확인:** 대소문자를 정확히 입력했는지 확인해주세요
2. **스키마 확인:** 테이블이 다른 스키마에 있다면 \`schema_name.table_name\` 형태로 작성해주세요
3. **데이터베이스 확인:** 올바른 데이터베이스에 연결되어 있는지 확인해주세요
4. **테이블 생성:** 테이블이 실제로 존재하지 않는다면 먼저 생성해주세요

현재 연결된 데이터베이스의 테이블 목록을 '데이터베이스 설정' 탭에서 확인할 수 있습니다.`,
        thinking: null,
      });
    }

    // 환경변수 다시 읽기 (에러 처리 시점에서)
    const LLM_PROVIDER = process.env.LLM || "LOCAL";
    const MODEL_NAME = process.env.MODEL || "qwen3-30b-a3b-mlx";
    const LM_STUDIO_URL = process.env.LM_STUDIO_URL || "http://localhost:1234";
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    const GEMINI_URL =
      process.env.GEMINI_URL ||
      "https://generativelanguage.googleapis.com/v1beta/models";

    const isGeminiError =
      LLM_PROVIDER === "GEMINI" || MODEL_NAME.startsWith("gemini");
    const actualModelError =
      isGeminiError && MODEL_NAME.startsWith("gemini")
        ? MODEL_NAME
        : isGeminiError
        ? "gemini-2.0-flash-exp"
        : MODEL_NAME;

    // LLM API 연결 오류인 경우
    if (error.message.includes("API") || error.message.includes("fetch")) {
      const providerName = isGeminiError ? "Google Gemini" : "LM Studio";
      const serverInfo = isGeminiError
        ? `Gemini API 서버 (${GEMINI_URL})`
        : `\`${LM_STUDIO_URL}\``;

      return NextResponse.json({
        success: true,
        analysis: `**${providerName} 연결 오류**

❌ **오류:** ${providerName} 서버에 연결할 수 없습니다.

**오류 상세:**
\`\`\`
${error.message}
\`\`\`

**해결 방법:**
1. **${providerName} 상태 확인:** ${providerName}${
          isGeminiError ? " API가 정상 작동하는지" : "가 실행 중인지"
        } 확인해주세요
2. **서버 주소 확인:** ${serverInfo}에서 실행 중인지 확인해주세요
${
  !isGeminiError
    ? `3. **모델 로드 확인:** LM Studio에서 모델이 로드되어 있는지 확인해주세요
4. **환경변수 확인:** LM_STUDIO_URL 환경변수가 올바른지 확인해주세요`
    : `3. **API 키 확인:** GEMINI_API_KEY 환경변수가 올바른지 확인해주세요
4. **API 할당량 확인:** Gemini API 사용량이 제한에 걸렸는지 확인해주세요
5. **URL 확인:** GEMINI_URL 환경변수가 올바른지 확인해주세요
6. **모델 이름 확인:** ${actualModelError} 모델이 존재하는지 확인해주세요`
}

**현재 설정:**
- **제공자:** ${isGeminiError ? "GEMINI" : "LOCAL"}
- **모델:** ${actualModelError}
${
  !isGeminiError
    ? `- **서버 URL:** ${LM_STUDIO_URL}`
    : `- **API URL:** ${GEMINI_URL}
- **API 상태:** ${GEMINI_API_KEY ? "설정됨" : "❌ 미설정"}`
}

**기본 성능 분석 (AI 분석 없이):**

쿼리 실행 계획을 확인하여 다음과 같은 일반적인 최적화 방법을 적용해보세요:

- **인덱스 검토:** WHERE 절과 GROUP BY에 사용되는 컬럼들에 인덱스가 있는지 확인
- **통계 정보 업데이트:** \`ANALYZE table_name;\` 명령으로 테이블 통계 정보 갱신
- **쿼리 구조 검토:** 불필요한 컬럼 선택이나 조인이 있는지 확인

${providerName} 서버가 정상 작동하면 더 상세한 분석을 받을 수 있습니다.`,
        thinking: null,
      });
    }

    return NextResponse.json(
      { success: false, message: `분석 중 오류 발생: ${error.message}` },
      { status: 500 }
    );
  }
}
