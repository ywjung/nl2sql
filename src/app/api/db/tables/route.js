import pool from "../../../lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const client = await pool.connect();
    const result = await client.query(`
      SELECT 
        t.table_name,
        obj_description(c.oid) as table_comment
      FROM information_schema.tables t
      LEFT JOIN pg_class c ON c.relname = t.table_name
      LEFT JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE t.table_schema = 'public' 
        AND t.table_type = 'BASE TABLE'
        AND n.nspname = 'public'
      ORDER BY t.table_name
    `);
    client.release();

    const tables = result.rows.map((row) => ({
      name: row.table_name,
      comment: row.table_comment || null,
    }));

    return NextResponse.json({ tables });
  } catch (error) {
    console.error("Error fetching tables:", error);
    return NextResponse.json(
      {
        success: false,
        message: "테이블 목록 조회 실패",
        error: error.message,
      },
      { status: 500 }
    );
  }
}
