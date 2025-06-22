import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const body = await request.json();

    // 환경변수에서 설정값 가져오기
    const LLM_PROVIDER = process.env.LLM || "LOCAL"; // LOCAL 또는 GEMINI
    const MODEL_NAME = process.env.MODEL || "qwen3-30b-a3b-mlx";
    const LM_STUDIO_URL = process.env.LM_STUDIO_URL || "http://localhost:1234";
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    const GEMINI_URL =
      process.env.GEMINI_URL ||
      "https://generativelanguage.googleapis.com/v1beta/models";
    const THINK_ENABLED = process.env.THINK === "true";
    const STREAM_ENABLED = process.env.STREAM === "true";

    // Gemini 모델 사용 여부 판단 (LLM=GEMINI 또는 MODEL이 gemini로 시작하는 경우)
    const isGemini =
      LLM_PROVIDER === "GEMINI" || MODEL_NAME.startsWith("gemini");

    // 스트리밍 여부 결정: Gemini는 스트리밍 미지원
    const shouldStream = STREAM_ENABLED && (body.stream || false) && !isGemini;

    if (isGemini) {
      // Google Gemini API 사용
      if (!GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY가 설정되지 않았습니다.");
      }

      // 실제 모델명 결정 (gemini-로 시작하면 해당 모델 사용, 아니면 기본값)
      const actualModel = MODEL_NAME.startsWith("gemini")
        ? MODEL_NAME
        : "gemini-2.0-flash";

      // Gemini API URL 생성
      const geminiUrl = `${GEMINI_URL}/${actualModel}:generateContent?key=${GEMINI_API_KEY}`;

      // 메시지를 Gemini 형태로 변환
      const systemMessage = body.messages.find((msg) => msg.role === "system");
      const userMessage = body.messages.find((msg) => msg.role === "user");

      const prompt = systemMessage
        ? `${systemMessage.content}\n\nUser: ${userMessage?.content || ""}`
        : userMessage?.content || "";

      const geminiPayload = {
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: body.temperature || 0.0,
          maxOutputTokens:
            body.max_tokens === -1 ? 8192 : body.max_tokens || 500,
        },
      };

      const response = await fetch(geminiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(geminiPayload),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(
          `Gemini API 응답 오류: ${response.status} ${response.statusText} - ${errorBody}`
        );
      }

      const geminiData = await response.json();

      // Gemini 응답을 OpenAI 형태로 변환
      const content =
        geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";

      if (!THINK_ENABLED) {
        // THINK=false일 때는 content를 바로 리턴
        return NextResponse.json({
          content: content.trim(),
          model: actualModel,
          usage: {
            prompt_tokens: geminiData.usageMetadata?.promptTokenCount || 0,
            completion_tokens:
              geminiData.usageMetadata?.candidatesTokenCount || 0,
            total_tokens: geminiData.usageMetadata?.totalTokenCount || 0,
          },
          think_enabled: false,
          provider: "GEMINI",
          raw_response: geminiData,
        });
      } else {
        // THINK=true일 때는 OpenAI 형태로 변환
        return NextResponse.json({
          id: `gemini-${Date.now()}`,
          object: "chat.completion",
          created: Math.floor(Date.now() / 1000),
          model: actualModel,
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content: content,
              },
              finish_reason: "stop",
            },
          ],
          usage: {
            prompt_tokens: geminiData.usageMetadata?.promptTokenCount || 0,
            completion_tokens:
              geminiData.usageMetadata?.candidatesTokenCount || 0,
            total_tokens: geminiData.usageMetadata?.totalTokenCount || 0,
          },
          provider: "GEMINI",
        });
      }
    } else {
      // LM Studio 사용 (기존 로직)
      const response = await fetch(`${LM_STUDIO_URL}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL_NAME,
          messages: body.messages,
          temperature: body.temperature || 0.0,
          max_tokens: body.max_tokens || -1,
          stream: shouldStream,
        }),
      });

      if (!response.ok) {
        throw new Error(
          `LM Studio API 응답 오류: ${response.status} ${response.statusText}`
        );
      }

      // 스트리밍인 경우와 아닌 경우를 구분해서 처리
      if (shouldStream) {
        // 스트리밍 응답 - LM Studio의 스트림을 그대로 클라이언트로 전달
        return new NextResponse(response.body, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        });
      } else {
        // 일반 JSON 응답
        const data = await response.json();

        // THINK=false일 때는 content를 바로 리턴
        if (
          !THINK_ENABLED &&
          data.choices &&
          data.choices[0] &&
          data.choices[0].message
        ) {
          const content = data.choices[0].message.content.trim();
          return NextResponse.json({
            content: content,
            model: data.model || MODEL_NAME,
            usage: data.usage || null,
            think_enabled: false,
            provider: "LOCAL",
            raw_response: data,
          });
        }

        // THINK=true이거나 일반적인 경우 전체 응답 리턴
        return NextResponse.json({
          ...data,
          provider: "LOCAL",
        });
      }
    }
  } catch (error) {
    console.error("LLM API 오류:", error);

    // 에러 메시지를 더 구체적으로 작성
    const errorMessage = error.message.includes("Gemini")
      ? `Gemini API 호출 실패: ${error.message}`
      : `LM Studio API 호출 실패: ${error.message}`;

    return NextResponse.json(
      {
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
