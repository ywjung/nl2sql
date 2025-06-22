import pool from "../../../lib/db";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const { sql } = await request.json();

    if (!sql) {
      return NextResponse.json(
        {
          success: false,
          message: "SQL 쿼리가 필요합니다",
        },
        { status: 400 }
      );
    }

    // 기본적인 SQL Injection 방지 (SELECT 쿼리만 허용)
    const trimmedSQL = sql.trim().toLowerCase();
    if (!trimmedSQL.startsWith("select") && !trimmedSQL.startsWith("with")) {
      return NextResponse.json(
        {
          success: false,
          message: "SELECT 쿼리만 허용됩니다.",
        },
        { status: 400 }
      );
    }

    const client = await pool.connect();
    const result = await client.query(sql);
    client.release();

    return NextResponse.json({
      success: true,
      data: result.rows,
      rowCount: result.rowCount,
    });
  } catch (error) {
    console.error("Error executing SQL:", error);
    return NextResponse.json(
      {
        success: false,
        message: "SQL 실행 실패",
        error: error.message,
      },
      { status: 500 }
    );
  }
}
