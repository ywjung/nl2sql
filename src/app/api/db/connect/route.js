import pool from "../../../lib/db";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const client = await pool.connect();
    await client.query("SELECT NOW()");
    client.release();

    return NextResponse.json({
      success: true,
      message: "데이터베이스 연결 성공",
    });
  } catch (error) {
    console.error("Database connection error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "데이터베이스 연결 실패",
        error: error.message,
      },
      { status: 500 }
    );
  }
}
