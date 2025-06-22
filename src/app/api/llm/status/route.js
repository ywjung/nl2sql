import { NextResponse } from "next/server";

export async function GET() {
  try {
    // 환경변수에서 현재 설정 가져오기
    const LLM_PROVIDER = process.env.LLM || "LOCAL";
    const MODEL_NAME = process.env.MODEL || "qwen3-30b-a3b-mlx";
    const LM_STUDIO_URL = process.env.LM_STUDIO_URL || "http://localhost:1234";
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    const GEMINI_URL =
      process.env.GEMINI_URL ||
      "https://generativelanguage.googleapis.com/v1beta/models";
    const THINK_ENABLED = process.env.THINK === "true";
    const STREAM_ENABLED = process.env.STREAM === "true";

    // Gemini 모델 사용 여부 판단
    const isGemini =
      LLM_PROVIDER === "GEMINI" || MODEL_NAME.startsWith("gemini");
    const actualProvider = isGemini ? "GEMINI" : "LOCAL";
    const actualModel =
      isGemini && MODEL_NAME.startsWith("gemini")
        ? MODEL_NAME
        : isGemini
        ? "gemini-2.0-flash"
        : MODEL_NAME;

    const status = {
      provider: actualProvider,
      model: actualModel,
      lmStudioUrl: LM_STUDIO_URL,
      geminiUrl: GEMINI_URL,
      geminiConfigured: !!GEMINI_API_KEY,
      thinkEnabled: THINK_ENABLED,
      streamEnabled: STREAM_ENABLED && !isGemini, // Gemini는 스트리밍 미지원
      isGemini: isGemini,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      status,
    });
  } catch (error) {
    console.error("LLM status fetch error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "LLM 상태 조회 실패",
        error: error.message,
      },
      { status: 500 }
    );
  }
}
