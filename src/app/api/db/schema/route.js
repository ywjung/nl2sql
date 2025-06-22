import pool from "../../../lib/db";
import { NextResponse } from "next/server";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const table = searchParams.get("table");

  if (!table) {
    return NextResponse.json(
      {
        success: false,
        message: "테이블 이름이 필요합니다",
      },
      { status: 400 }
    );
  }

  try {
    const client = await pool.connect();
    const result = await client.query(
      `
      SELECT 
        isc.column_name, 
        isc.data_type, 
        isc.is_nullable,
        col_description(pgc.oid, isc.ordinal_position) as column_comment
      FROM information_schema.columns isc
      LEFT JOIN pg_class pgc ON pgc.relname = isc.table_name
      LEFT JOIN pg_namespace n ON n.oid = pgc.relnamespace
      WHERE isc.table_name = $1 
        AND isc.table_schema = 'public'
        AND n.nspname = 'public'
      ORDER BY isc.ordinal_position
    `,
      [table]
    );
    client.release();

    const columns = result.rows.map((row) => ({
      name: row.column_name,
      type: row.data_type,
      nullable: row.is_nullable === "YES",
      comment: row.column_comment || null,
    }));

    return NextResponse.json({ columns });
  } catch (error) {
    console.error("Error fetching schema:", error);
    return NextResponse.json(
      {
        success: false,
        message: "스키마 조회 실패",
        error: error.message,
      },
      { status: 500 }
    );
  }
}
