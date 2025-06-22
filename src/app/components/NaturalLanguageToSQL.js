"use client";

import React, { useState, useEffect } from "react";
import Markdown from "react-markdown";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  ChevronDown,
  ChevronUp,
  History,
  Star,
  StarOff,
  Download,
  Copy,
  Play,
  Zap,
  Eye,
  EyeOff,
  Filter,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  TrendingUp,
  Trash2,
  X,
} from "lucide-react";

const NaturalLanguageToSQL = () => {
  // --- 기존 상태 변수들 ---
  const [activeTab, setActiveTab] = useState("settings");

  // lib/db.js 패턴을 따라 환경 변수에서 기본값 가져오기
  const getClientDbConfig = () => {
    const host = process.env.NEXT_PUBLIC_DB_HOST || "";
    const port = process.env.NEXT_PUBLIC_DB_PORT || "";
    const database = process.env.NEXT_PUBLIC_DB_NAME || "";
    const username = process.env.NEXT_PUBLIC_DB_USER || "";
    const driver = process.env.NEXT_PUBLIC_DB_DRIVER || "";

    return {
      url:
        process.env.NEXT_PUBLIC_DB_URL ||
        `jdbc:postgresql://${host}:${port}/${database}`,
      username,
      password: "", // 보안상 빈 값으로 시작 - 사용자가 직접 입력해야 함
      driverClassName: driver,
      host,
      port: parseInt(port, 10),
      database,
    };
  };

  const [dbConfig, setDbConfig] = useState(getClientDbConfig());

  const [tables, setTables] = useState([]);
  const [selectedTables, setSelectedTables] = useState([]);
  const [tableSchema, setTableSchema] = useState({});
  const [naturalLanguage, setNaturalLanguage] = useState("");
  const [generatedSQL, setGeneratedSQL] = useState("");
  const [editableSQL, setEditableSQL] = useState("");
  const [llmThinking, setLlmThinking] = useState("");
  const [queryResults, setQueryResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [error, setError] = useState("");
  const [isReasoningOpen, setIsReasoningOpen] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [sqlFormatter, setSqlFormatter] = useState(null);
  const [columnTranslations, setColumnTranslations] = useState({});
  const [sqlConversionTime, setSqlConversionTime] = useState(null);
  const [queryExecutionTime, setQueryExecutionTime] = useState(null);
  const [performanceAnalysis, setPerformanceAnalysis] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [llmStatus, setLlmStatus] = useState(null);

  // --- 새로운 상태 변수들 (메모리 기반) ---
  const [queryHistory, setQueryHistory] = useState([]);
  const [favoriteQueries, setFavoriteQueries] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);
  const [showVisualization, setShowVisualization] = useState(false);
  const [chartType, setChartType] = useState("bar");
  const [filters, setFilters] = useState({});
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  // 환경 변수에서 API URL들 가져오기
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "";

  // lib/db.js의 getCurrentDbInfo() 패턴을 따라 현재 DB 정보 반환 (비밀번호 제외)
  const getCurrentClientDbInfo = () => {
    return {
      type: "client",
      host: dbConfig.host || parseJdbcUrl(dbConfig.url).host,
      port: dbConfig.port || parseJdbcUrl(dbConfig.url).port,
      database: dbConfig.database || parseJdbcUrl(dbConfig.url).database,
      username: dbConfig.username,
      driverClassName: dbConfig.driverClassName,
      url: dbConfig.url,
    };
  };

  // lib/db.js의 parseJdbcUrl 함수와 동일한 로직
  const parseJdbcUrl = (jdbcUrl) => {
    try {
      const urlPattern =
        /^jdbc:postgresql:\/\/([^:/?]+):(\d+)\/([^?]+)(\?.*)?$/;
      const match = jdbcUrl.match(urlPattern);

      if (!match) {
        // 포트가 없는 경우도 처리 (기본 포트 5432 사용)
        const simplePattern = /^jdbc:postgresql:\/\/([^/?]+)\/([^?]+)(\?.*)?$/;
        const simpleMatch = jdbcUrl.match(simplePattern);

        if (simpleMatch) {
          return {
            host: simpleMatch[1],
            port: 5432, // PostgreSQL 기본 포트
            database: simpleMatch[2],
          };
        }

        throw new Error(`잘못된 JDBC URL 형식입니다: ${jdbcUrl}`);
      }

      const host = match[1];
      const port = parseInt(match[2], 10);
      const database = match[3];

      // 유효성 검증
      if (!host || !database) {
        throw new Error("호스트와 데이터베이스 이름이 필요합니다.");
      }

      if (isNaN(port) || port <= 0 || port > 65535) {
        throw new Error(`유효하지 않은 포트 번호입니다: ${match[2]}`);
      }

      return { host, port, database };
    } catch (error) {
      console.error("JDBC URL 파싱 오류:", error);
      throw new Error(`JDBC URL 파싱 실패: ${error.message}`);
    }
  };

  // --- useEffect Hooks ---
  useEffect(() => {
    // lib/db.js 패턴을 따라 환경 변수에서 데이터베이스 설정 로드
    const loadEnvConfig = () => {
      const envDbConfig = getClientDbConfig();

      setDbConfig((prevConfig) => ({
        ...envDbConfig,
        password: prevConfig.password, // 기존 password 값 유지 (보안상 env에서 로드하지 않음)
      }));

      console.log("클라이언트 DB 설정 로드됨:", {
        host: envDbConfig.host,
        port: envDbConfig.port,
        database: envDbConfig.database,
        username: envDbConfig.username,
        driver: envDbConfig.driverClassName,
      });
    };

    loadEnvConfig();
  }, []);

  useEffect(() => {
    // SQL 포매터 라이브러리 동적 로드
    const loadSqlFormatter = async () => {
      try {
        const script = document.createElement("script");
        script.src =
          "https://cdnjs.cloudflare.com/ajax/libs/sql-formatter/4.0.2/sql-formatter.min.js";
        script.onload = () => {
          if (window.sqlFormatter) {
            setSqlFormatter(window.sqlFormatter);
          }
        };
        document.head.appendChild(script);

        return () => {
          if (document.head.contains(script)) {
            document.head.removeChild(script);
          }
        };
      } catch (error) {
        console.warn("SQL formatter 로드 실패:", error);
      }
    };

    loadSqlFormatter();
  }, []);

  useEffect(() => {
    // lib/db.js 패턴을 따라 선택된 테이블의 스키마 정보 가져오기
    const fetchSchemaForTables = async () => {
      for (const tableName of selectedTables) {
        if (!tableSchema[tableName]) {
          try {
            console.log(`테이블 스키마 조회 중: ${tableName}`);

            const response = await fetch(
              `${API_BASE_URL}/api/db/schema?table=${tableName}`
            );

            if (!response.ok) {
              throw new Error(
                `HTTP ${response.status}: ${response.statusText}`
              );
            }

            const data = await response.json();

            if (data.columns) {
              setTableSchema((prevSchema) => ({
                ...prevSchema,
                [tableName]: data.columns,
              }));
              console.log(
                `테이블 ${tableName} 스키마 로드됨: ${data.columns.length}개 컬럼`
              );
            } else {
              console.warn(`테이블 ${tableName}의 스키마 정보가 없습니다.`);
            }
          } catch (err) {
            console.error(`테이블 ${tableName} 스키마 조회 오류:`, err);
          }
        }
      }
    };

    if (selectedTables.length > 0) {
      fetchSchemaForTables();
    }
  }, [selectedTables, API_BASE_URL]);

  useEffect(() => {
    // 컴포넌트 마운트 시 LLM 상태 가져오기
    fetchLlmStatus();
  }, []);

  useEffect(() => {
    // query 탭으로 전환될 때 LLM 상태 갱신
    if (activeTab === "query") {
      fetchLlmStatus();
    }
  }, [activeTab]);

  // --- 새로운 Helper Functions ---
  const saveToHistory = (query, sql, results) => {
    const historyItem = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      naturalLanguage: query,
      sql: sql,
      resultCount: results ? results.length : 0,
      executionTime: queryExecutionTime,
    };

    const newHistory = [historyItem, ...queryHistory.slice(0, 49)]; // 최대 50개 유지
    setQueryHistory(newHistory);
  };

  const deleteHistoryItem = (itemId) => {
    const newHistory = queryHistory.filter((item) => item.id !== itemId);
    setQueryHistory(newHistory);
  };

  const clearAllHistory = () => {
    if (
      window.confirm(
        "전체 히스토리를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다."
      )
    ) {
      setQueryHistory([]);
    }
  };

  const toggleFavorite = (query, sql) => {
    const favoriteItem = {
      id: Date.now(),
      naturalLanguage: query,
      sql: sql,
      timestamp: new Date().toISOString(),
    };

    const existingIndex = favoriteQueries.findIndex(
      (fav) => fav.naturalLanguage === query && fav.sql === sql
    );

    let newFavorites;
    if (existingIndex >= 0) {
      newFavorites = favoriteQueries.filter(
        (_, index) => index !== existingIndex
      );
    } else {
      newFavorites = [favoriteItem, ...favoriteQueries];
    }

    setFavoriteQueries(newFavorites);
  };

  const deleteFavoriteItem = (itemId) => {
    const newFavorites = favoriteQueries.filter((item) => item.id !== itemId);
    setFavoriteQueries(newFavorites);
  };

  const clearAllFavorites = () => {
    if (
      window.confirm(
        "전체 즐겨찾기를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다."
      )
    ) {
      setFavoriteQueries([]);
    }
  };

  const isFavorite = (query, sql) => {
    return favoriteQueries.some(
      (fav) => fav.naturalLanguage === query && fav.sql === sql
    );
  };

  const loadFromHistory = (historyItem) => {
    setNaturalLanguage(historyItem.naturalLanguage);
    setGeneratedSQL(historyItem.sql);
    setEditableSQL(formatSQL(historyItem.sql));
    setShowHistory(false);
  };

  const loadFromFavorites = (favoriteItem) => {
    setNaturalLanguage(favoriteItem.naturalLanguage);
    setGeneratedSQL(favoriteItem.sql);
    setEditableSQL(formatSQL(favoriteItem.sql));
    setShowFavorites(false);
  };

  const generateChartData = (data) => {
    if (!data || data.length === 0) return [];

    const keys = Object.keys(data[0]);
    const numericColumns = keys.filter((key) =>
      data.some((row) => !isNaN(parseFloat(row[key])) && isFinite(row[key]))
    );

    if (numericColumns.length === 0) return [];

    // 데이터가 1행일 때 (집계 결과 등)
    if (data.length === 1) {
      const row = data[0];
      // 각 숫자 컬럼을 별도의 데이터 포인트로 변환
      return numericColumns.map((col, index) => ({
        name: columnTranslations[col] || col, // 한글 번역이 있으면 사용
        value: parseFloat(row[col]) || 0,
        [col]: parseFloat(row[col]) || 0,
      }));
    }

    // 여러 행일 때 (일반적인 경우)
    return data.slice(0, 20).map((row, index) => {
      const firstKey = keys[0];
      const name = row[firstKey] || `Row ${index + 1}`;

      const result = {
        name:
          String(name).length > 15
            ? String(name).substring(0, 15) + "..."
            : String(name),
      };

      numericColumns.forEach((col) => {
        result[col] = parseFloat(row[col]) || 0;
      });

      return result;
    });
  };

  const renderVisualization = () => {
    if (!queryResults || queryResults.length === 0) return null;

    const chartData = generateChartData(queryResults);
    if (chartData.length === 0)
      return (
        <div className="text-center py-8 text-gray-500">
          📊 시각화할 수 있는 숫자 데이터가 없습니다
        </div>
      );

    const colors = [
      "#3B82F6",
      "#EF4444",
      "#10B981",
      "#F59E0B",
      "#8B5CF6",
      "#06B6D4",
      "#EC4899",
      "#10B981",
    ];

    // 데이터가 1행일 때와 여러 행일 때 구분
    const isSingleRowData = queryResults.length === 1;

    if (isSingleRowData) {
      // 단일 행 데이터의 경우
      const numericColumns = Object.keys(queryResults[0]).filter(
        (key) =>
          !isNaN(parseFloat(queryResults[0][key])) &&
          isFinite(queryResults[0][key])
      );

      switch (chartType) {
        case "line":
          return (
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={colors[0]}
                  strokeWidth={3}
                  dot={{ fill: colors[0], strokeWidth: 2, r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          );
        case "pie":
          return (
            <ResponsiveContainer width="100%" height={400}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent, value }) =>
                    `${name}: ${value.toLocaleString()} (${(
                      percent * 100
                    ).toFixed(1)}%)`
                  }
                  outerRadius={120}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={colors[index % colors.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [value.toLocaleString(), "Value"]}
                />
              </PieChart>
            </ResponsiveContainer>
          );
        default: // bar
          return (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={chartData} margin={{ bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="name"
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  interval={0}
                />
                <YAxis />
                <Tooltip
                  formatter={(value) => [value.toLocaleString(), "Value"]}
                />
                <Legend />
                <Bar dataKey="value" fill={colors[0]} name="Count">
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={colors[index % colors.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          );
      }
    } else {
      // 여러 행 데이터의 경우 (기존 로직)
      const numericColumns = Object.keys(chartData[0]).filter(
        (key) => key !== "name"
      );

      switch (chartType) {
        case "line":
          return (
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                {numericColumns.map((col, index) => (
                  <Line
                    key={col}
                    type="monotone"
                    dataKey={col}
                    stroke={colors[index % colors.length]}
                    strokeWidth={2}
                    name={columnTranslations[col] || col}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          );
        case "pie":
          if (numericColumns.length > 0) {
            const pieData = chartData.map((item) => ({
              name: item.name,
              value: item[numericColumns[0]],
            }));
            return (
              <ResponsiveContainer width="100%" height={400}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent, value }) =>
                      `${name}: ${value.toLocaleString()} (${(
                        percent * 100
                      ).toFixed(1)}%)`
                    }
                    outerRadius={120}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={colors[index % colors.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => [
                      value.toLocaleString(),
                      columnTranslations[numericColumns[0]] ||
                        numericColumns[0],
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            );
          }
          return null;
        default: // bar
          return (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                {numericColumns.map((col, index) => (
                  <Bar
                    key={col}
                    dataKey={col}
                    fill={colors[index % colors.length]}
                    name={columnTranslations[col] || col}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          );
      }
    }
  };

  // --- 기존 Helper Functions ---
  const formatSQL = (sql) => {
    if (!sql) return "";
    if (sqlFormatter) {
      try {
        return sqlFormatter.format(sql, {
          language: "postgresql",
          indent: "  ",
          uppercase: true,
          linesBetweenQueries: 2,
        });
      } catch (error) {
        console.warn("SQL 포맷팅 실패:", error);
        return sql;
      }
    }
    // 포매터 로드 전 또는 실패 시 간단한 폴백 포맷팅
    return sql
      .replace(
        /\b(SELECT|FROM|WHERE|JOIN|INNER JOIN|LEFT JOIN|RIGHT JOIN|GROUP BY|ORDER BY|HAVING|UNION|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\b/gi,
        "\n$1"
      )
      .replace(/,/g, ",\n  ")
      .trim();
  };

  const getLastLine = (text) => {
    if (!text) return "";
    const lines = text.split("\n").filter((line) => line.trim());
    return lines.length > 0 ? lines[lines.length - 1] : "";
  };

  const parseStreamChunk = (chunk) => {
    const lines = chunk.split("\n");
    let content = "";
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const jsonStr = line.substring(6).trim();
        if (jsonStr === "[DONE]") continue;
        try {
          const parsed = JSON.parse(jsonStr);
          content += parsed.choices?.[0]?.delta?.content || "";
        } catch (e) {
          console.warn("스트림 파싱 오류:", jsonStr, e);
        }
      }
    }
    return content;
  };

  const extractTagContent = (text, tag) => {
    const regex = new RegExp(`<${tag}>(.*?)(?:</${tag}>|$)`, "s");
    const match = text.match(regex);
    return match ? match[1].trim() : "";
  };

  // --- Core Logic Functions (실제 API 사용) ---
  const fetchLlmStatus = async () => {
    try {
      console.log("LLM 상태 조회 중...");

      const response = await fetch(`${API_BASE_URL}/api/llm/status`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        setLlmStatus(data.status);
        console.log("LLM 상태 조회 성공:", {
          model: data.status.model,
          isGemini: data.status.isGemini,
          thinkEnabled: data.status.thinkEnabled,
          streamEnabled: data.status.streamEnabled,
        });
      } else {
        const errorMessage = data.message || "LLM 상태 조회 실패";
        console.error("LLM 상태 조회 실패:", errorMessage);
      }
    } catch (error) {
      console.error("LLM 상태 조회 API 오류:", error);
    }
  };

  const testConnection = async () => {
    setLoading(true);
    setError("");
    setGeneratedSQL("");
    setEditableSQL("");
    setLlmThinking("");
    setQueryResults(null);
    setIsReasoningOpen(false);
    setColumnTranslations({});
    setSqlConversionTime(null);
    setQueryExecutionTime(null);
    setPerformanceAnalysis(null);

    try {
      // lib/db.js 패턴에 따른 상세한 로깅
      const dbInfo = getCurrentClientDbInfo();
      console.log("데이터베이스 연결 시도:", {
        host: dbInfo.host,
        port: dbInfo.port,
        database: dbInfo.database,
        username: dbInfo.username,
        driver: dbInfo.driverClassName,
      });

      const response = await fetch(`${API_BASE_URL}/api/db/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dbConfig),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        console.log("데이터베이스 연결 성공");

        // 테이블 목록 가져오기
        const tablesResponse = await fetch(`${API_BASE_URL}/api/db/tables`);
        if (!tablesResponse.ok) {
          throw new Error(
            `테이블 목록 조회 실패: HTTP ${tablesResponse.status}`
          );
        }

        const tablesData = await tablesResponse.json();
        setTables(tablesData.tables || []);
        setConnectionStatus("connected");

        console.log(
          `${tablesData.tables?.length || 0}개의 테이블을 발견했습니다.`
        );
      } else {
        throw new Error(data.message || "연결 실패");
      }
    } catch (err) {
      const errorMessage = err.message || "데이터베이스 연결에 실패했습니다.";
      console.error("데이터베이스 연결 오류:", err);
      setError(errorMessage);
      setConnectionStatus("error");
    } finally {
      setLoading(false);
    }
  };

  const convertToSQL = async () => {
    if (!naturalLanguage.trim() || selectedTables.length === 0) {
      setError("자연어 질의와 하나 이상의 테이블을 선택해주세요.");
      return;
    }

    const startTime = performance.now();
    setSqlConversionTime(null);
    setQueryExecutionTime(null);

    setLoading(true);
    setError("");
    setGeneratedSQL("");
    setEditableSQL("");
    setLlmThinking("");
    setQueryResults(null);
    setIsReasoningOpen(false);
    setColumnTranslations({});
    setPerformanceAnalysis(null);

    try {
      // lib/db.js 패턴에 따른 상세한 로깅
      console.log("SQL 변환 시작:", {
        query:
          naturalLanguage.substring(0, 100) +
          (naturalLanguage.length > 100 ? "..." : ""),
        selectedTables: selectedTables,
        database: getCurrentClientDbInfo().database,
      });

      // THINK 모드에 따라 다른 처리
      const isThinkEnabled = llmStatus?.thinkEnabled || false;
      const isStreamEnabled = llmStatus?.streamEnabled || false;
      const isGemini = llmStatus?.isGemini || false;

      console.log("LLM 설정:", {
        model: llmStatus?.model,
        thinkEnabled: isThinkEnabled,
        streamEnabled: isStreamEnabled,
        isGemini: isGemini,
      });

      // Gemini는 스트리밍을 지원하지 않음
      setIsStreaming(isThinkEnabled && isStreamEnabled && !isGemini);

      // 테이블과 컬럼 메타데이터를 포함한 스키마 정보 생성
      const schemaInfo = selectedTables
        .map((tableName) => {
          const tableInfo = tables.find((t) => t.name === tableName);
          const columns = tableSchema[tableName] || [];

          let tableDesc = `- Table: ${tableName}`;
          if (tableInfo?.comment) {
            tableDesc += `\n  Description: ${tableInfo.comment}`;
          }

          tableDesc += `\n  Columns:`;
          columns.forEach((col) => {
            tableDesc += `\n    • ${col.name} (${col.type})`;
            if (col.comment) {
              tableDesc += ` - ${col.comment}`;
            }
          });

          return tableDesc;
        })
        .join("\n\n");

      let systemPrompt;

      if (isThinkEnabled) {
        // THINK=true 모드: 상세 분석 프롬프트
        const currentTime = new Date();
        const currentTimestamp = currentTime.toISOString();
        const currentDate = currentTime.toISOString().split("T")[0];

        systemPrompt = `
You are a God-Tier PostgreSQL Architect. Your sole purpose is to translate natural language into **secure, performant, and highly readable** PostgreSQL queries, following all specified methodologies. You also provide Korean translations for the final column headers.

### CORE DIRECTIVES
1.  **THE FORMAT IS LAW:** Your response MUST be in this exact format: \`<think>...</think><columns>...</columns><sql>...</sql>\`.
2.  **THE SCHEMA PRISON:** You can ONLY use the tables and columns provided below. Any attempt to use others is FORBIDDEN.
3.  **Column PRISON:** Only columns belonging to the specified table can be used. Attempts to use anything else are strictly prohibited.

### AVAILABLE RESOURCES
**1. Schema Information with Business Context:**
${schemaInfo}

**2. Current Time Information:**
-   Current Timestamp (ISO): ${currentTimestamp}
-   Current Date: ${currentDate}
-   Timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}

### THE 6-STEP THINKING PROCESS (MANDATORY CHECKLIST)

You MUST follow these 6 steps inside the \`<think>\` tag for EVERY query.

**Step 1: Deconstruct Intent.**
-   Identify the core question, required data, and calculations.
-   Use the table and column descriptions/comments to understand the business context better.

**Step 2: Classify Query Type.**
-   Is this a SELECT, AGGREGATION, JOIN? Is it Time Interval or Time Component grouping?

**Step 3: Column Grounding and Validation (THE MOST CRITICAL STEP)**
-   **A. Identify Target Table(s):** Based on the user's request, identify the necessary table(s). Consider table descriptions to understand their purpose.
-   **B. List Available Columns:** Look at the provided schema under "AVAILABLE RESOURCES" and explicitly list all available columns for each target table with their descriptions.
-   **C. Map User Intent to AVAILABLE Columns:** Map the core parts of the user's request to the columns you just listed in Step B. Use column comments/descriptions to better understand what each column represents.
-   **D. CRITICAL CHECK - Find the Date Column:** Look at your list of available columns from Step B. Find the actual date/timestamp column by examining both column names AND their descriptions/comments. You MUST use this column.
-   **E. FINAL VERDICT:**
    - **If a valid date column is found:** "All parts of the user request can be mapped. I will proceed using the \`[actual_column_name]\` column for the date filter."
    - **If NO date column is found:** "QUERY IMPOSSIBLE. The target table has no date/timestamp column in the schema. I will not invent a column like \`created_at\`. I will output an explanation instead of SQL."

**Step 4: Formulate Query Plan & Join Strategy.**
-   **A. Tables & Joins:** Identify all necessary tables using their descriptions to understand relationships. For each join, specify the join type (\`INNER\`, \`LEFT\`) and the exact \`ON\` condition. Explain your reasoning for choosing the join keys.
-   **B. Filtering:** Detail the conditions for the \`WHERE\` clause.
-   **C. Grouping & Aggregation:** Specify the \`GROUP BY\` columns and all aggregate functions (\`COUNT\`, \`SUM\`, etc.).

**Step 5: Refine for Readability & Column Aliasing.**
-   **A. Readability:** Use formatting and CTEs (if complex) to make the SQL easy to understand.
-   **B. Aliasing (MANDATORY):** Assign a clear, descriptive alias to EVERY column in the final \`SELECT\` list using \`AS\`. Use column descriptions to create meaningful Korean aliases when possible.
-   **C. Alias-JSON Consistency:** The aliases defined here MUST be the keys in the \`<columns>\` JSON object. This is not optional.

**Step 6: Final Sanity Check.**
-   Does my final SQL query accurately reflect the user's intent and follow ALL rules, including the Step 3 validation?
-   Are my Korean translations in the \`<columns>\` section meaningful and based on the column descriptions?

### SQL GENERATION CODEX
**1. COLUMN HEADER TRANSLATION (CRITICAL):**
   - After \`<think>\`, you MUST include a \`<columns>\` tag with a JSON object mapping every SQL alias to a Korean description.
   - Use the column comments/descriptions to create more meaningful Korean translations.
   - Example: \`<columns>{"user_name": "사용자 이름", "order_count": "주문 건수"}</columns>\`

**2. Time-Based Query Patterns (METHODOLOGY IS LAW):**
   - When filtering for a specific year (e.g., "in 2023"), you MUST use one of the following two methods. Do NOT use \`DATE_TRUNC\` in the \`WHERE\` clause for a single year.
     - **Method 1 (EXTRACT):** \`WHERE EXTRACT(YEAR FROM your_date_column) = 2023\`
     - **Method 2 (Range):** \`WHERE your_date_column >= '2023-01-01' AND your_date_column < '2024-01-01'\`
   - When grouping by a time period (day, month, year), use \`DATE_TRUNC\` in the \`GROUP BY\` clause.
     - **Example:** \`GROUP BY DATE_TRUNC('month', your_date_column)\`

**3. Column Existence Guarantee (ABSOLUTE):**
   - Every single column you use in a \`SELECT\`, \`WHERE\`, \`GROUP BY\`, or \`JOIN\` clause MUST exist in the schema provided under **AVAILABLE RESOURCES**.
   - Before outputting the final SQL, do one last check: is every column in your query present in the schema for its respective table? If not, the query is invalid. You must explain why instead of providing a faulty SQL.

**4. General Best Practices:**
   - Always use table aliases.
   - Always use descriptive column aliases (\`AS ...\`) based on column descriptions.
   - NEVER use \`SELECT *\`.
   - Leverage the business context from table and column descriptions to create more accurate queries.`;
      } else {
        // THINK=false 모드: 간단한 SQL 생성 프롬프트
        systemPrompt = `You are an expert PostgreSQL query generator. Generate clean, efficient SQL queries based on the provided schema and natural language input.

Available Schema:
${schemaInfo}

Rules:
1. Only use tables and columns from the provided schema
2. Generate clean, readable PostgreSQL queries
3. Use appropriate table aliases
4. Return only the SQL query without any explanations or tags
5. Use EXTRACT(YEAR FROM column) for year filtering
6. Always include meaningful column aliases with AS`;
      }

      const requestBody = {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: naturalLanguage },
        ],
        temperature: 0.0,
        max_tokens: isThinkEnabled ? 4096 : 500,
        stream: isThinkEnabled && isStreamEnabled && !isGemini,
      };

      const response = await fetch(`${API_BASE_URL}/api/llm`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept:
            isThinkEnabled && isStreamEnabled && !isGemini
              ? "text/event-stream"
              : "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: { message: response.statusText } }));
        throw new Error(
          `LLM API 호출 실패 (HTTP ${response.status}): ${
            response.statusText
          } - ${errorData.error?.message || ""}`
        );
      }

      if (isThinkEnabled && isStreamEnabled && !isGemini) {
        // 스트리밍 모드 처리
        let accumulatedContent = "";
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.trim() === "") continue;
            const content = parseStreamChunk(line + "\n");
            if (content) {
              accumulatedContent += content;
              const thinkingContent = extractTagContent(
                accumulatedContent,
                "think"
              );
              if (thinkingContent && thinkingContent !== llmThinking) {
                setLlmThinking(thinkingContent);
              }
            }
          }
        }

        if (buffer.trim()) {
          const content = parseStreamChunk(buffer);
          if (content) accumulatedContent += content;
        }

        const finalThinking = extractTagContent(accumulatedContent, "think");
        const finalColumnsJSON = extractTagContent(
          accumulatedContent,
          "columns"
        );
        const finalSQL = extractTagContent(accumulatedContent, "sql");

        if (finalThinking) setLlmThinking(finalThinking);
        else if (accumulatedContent.trim())
          setLlmThinking("AI가 분석 과정을 제공하지 않았습니다.");

        if (finalColumnsJSON) {
          try {
            const parsedTranslations = JSON.parse(finalColumnsJSON);
            setColumnTranslations(parsedTranslations);
          } catch (e) {
            console.error("컬럼 번역 JSON 파싱 실패:", e, finalColumnsJSON);
            setColumnTranslations({});
          }
        }

        if (finalSQL) {
          const cleanSQL = finalSQL
            .replace(/```sql\n?|```|<[^>]*>/g, "")
            .trim();
          setGeneratedSQL(cleanSQL);
          setEditableSQL(formatSQL(cleanSQL));
        } else {
          throw new Error("유효한 SQL을 추출할 수 없습니다.");
        }
      } else {
        // 비스트리밍 모드 처리
        const data = await response.json();

        if (data.content) {
          // THINK=false 모드의 직접 content 응답
          let cleanSQL = data.content;

          // SQL 정리
          cleanSQL = cleanSQL
            .replace(/```sql\n?|```/g, "")
            .replace(/^\s*SQL:\s*/i, "")
            .trim();

          setGeneratedSQL(cleanSQL);
          setEditableSQL(formatSQL(cleanSQL));
          setLlmThinking(
            `모델: ${
              data.model || "알 수 없음"
            }\n모드: 빠른 SQL 생성 (THINK=false)\n토큰 사용량: ${
              data.usage?.total_tokens || "알 수 없음"
            }`
          );
        } else if (data.choices && data.choices[0]) {
          // THINK=true 비스트리밍 모드
          const content = data.choices[0].message.content;

          const finalThinking = extractTagContent(content, "think");
          const finalColumnsJSON = extractTagContent(content, "columns");
          const finalSQL = extractTagContent(content, "sql");

          if (finalThinking) setLlmThinking(finalThinking);

          if (finalColumnsJSON) {
            try {
              const parsedTranslations = JSON.parse(finalColumnsJSON);
              setColumnTranslations(parsedTranslations);
            } catch (e) {
              console.error("컬럼 번역 JSON 파싱 실패:", e);
              setColumnTranslations({});
            }
          }

          if (finalSQL) {
            const cleanSQL = finalSQL
              .replace(/```sql\n?|```|<[^>]*>/g, "")
              .trim();
            setGeneratedSQL(cleanSQL);
            setEditableSQL(formatSQL(cleanSQL));
          } else {
            throw new Error("유효한 SQL을 추출할 수 없습니다.");
          }
        } else {
          throw new Error("예상하지 못한 응답 형식입니다.");
        }
      }
    } catch (err) {
      const errorMessage = `SQL 변환 중 오류가 발생했습니다: ${err.message}`;
      console.error("SQL 변환 오류:", err);
      setError(errorMessage);
    } finally {
      const endTime = performance.now();
      const conversionTime = (endTime - startTime) / 1000;
      setSqlConversionTime(conversionTime);
      console.log(`SQL 변환 시간: ${conversionTime.toFixed(2)}초`);
      setLoading(false);
      setIsStreaming(false);
    }
  };

  const executeSQL = async () => {
    if (!editableSQL.trim()) {
      setError("실행할 SQL 쿼리가 없습니다.");
      return;
    }

    const startTime = performance.now();
    setQueryExecutionTime(null);

    setLoading(true);
    setError("");
    setQueryResults(null);
    setPerformanceAnalysis(null);

    try {
      console.log("SQL 쿼리 실행 중...", {
        database: getCurrentClientDbInfo().database,
        sqlLength: editableSQL.length,
      });

      const response = await fetch(`${API_BASE_URL}/api/db/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql: editableSQL }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        setQueryResults(data.data);
        console.log(`쿼리 실행 성공: ${data.data?.length || 0}개 행 반환`);

        // 히스토리에 저장
        saveToHistory(naturalLanguage, editableSQL, data.data);
      } else {
        // lib/db.js 패턴에 따른 상세한 에러 처리
        if (data.error && typeof data.error === "object") {
          let detailedError = `SQL Error [${data.error.sqlState || "N/A"}]: ${
            data.error.errorMessage || "Unknown Error"
          }`;
          if (data.error.position > 0) {
            detailedError += `\n  Position: ${data.error.position}`;
          }
          if (data.error.detail) {
            detailedError += `\n\n[Detail]\n${data.error.detail}`;
          }
          if (data.error.hint) {
            detailedError += `\n\n[Hint]\n${data.error.hint}`;
          }
          if (data.error.query) {
            detailedError += `\n\n[Failed Query]\n${editableSQL}`;
          }

          console.error("SQL 실행 오류:", data.error);
          setError(detailedError);
        } else {
          const errorMessage =
            data.message || "알 수 없는 백엔드 오류가 발생했습니다.";
          console.error("SQL 실행 실패:", errorMessage);
          setError(errorMessage);
        }
      }
    } catch (err) {
      const errorMessage = `API 요청 중 치명적인 오류가 발생했습니다: ${err.message}`;
      console.error("SQL 실행 API 오류:", err);
      setError(errorMessage);
    } finally {
      const endTime = performance.now();
      const executionTime = (endTime - startTime) / 1000;
      setQueryExecutionTime(executionTime);
      console.log(`쿼리 실행 시간: ${executionTime.toFixed(2)}초`);
      setLoading(false);
    }
  };

  const analyzePerformance = async (sql) => {
    if (!sql?.trim()) {
      setError("분석할 SQL 쿼리가 없습니다.");
      return;
    }

    setIsAnalyzing(true);
    setPerformanceAnalysis(null);
    setError("");

    try {
      console.log("성능 분석 시작:", {
        database: getCurrentClientDbInfo().database,
        sqlLength: sql.length,
      });

      const response = await fetch(`${API_BASE_URL}/api/db/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql, dbConfig }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const analysisData = await response.json();

      if (analysisData.success) {
        setPerformanceAnalysis(analysisData.analysis);
        console.log("성능 분석 완료");
      } else {
        const errorMessage = `성능 분석 실패: ${analysisData.message}`;
        console.error("성능 분석 오류:", analysisData.message);
        setError(errorMessage);
      }
    } catch (error) {
      const errorMessage = `성능 분석 중 오류 발생: ${error.message}`;
      console.error("성능 분석 API 오류:", error);
      setError(errorMessage);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleTableSelection = (tableName) => {
    setSelectedTables((prevSelected) =>
      prevSelected.includes(tableName)
        ? prevSelected.filter((t) => t !== tableName)
        : [...prevSelected, tableName]
    );
  };

  const handleSelectAllToggle = () => {
    const tableNames = tables.map((t) => t.name);
    if (selectedTables.length === tableNames.length) {
      setSelectedTables([]);
    } else {
      setSelectedTables([...tableNames]);
    }
  };

  const copySQL = async () => {
    if (!editableSQL) return;
    try {
      await navigator.clipboard.writeText(editableSQL);
      const copyButton = document.getElementById("copy-sql-button");
      if (copyButton) {
        const originalText = copyButton.innerHTML;
        copyButton.innerHTML = "복사됨!";
        setTimeout(() => {
          copyButton.innerHTML = originalText;
        }, 1000);
      }
    } catch (err) {
      console.error("SQL 복사 실패:", err);
    }
  };

  const downloadResults = () => {
    if (!queryResults || queryResults.length === 0) return;
    const headers = Object.keys(queryResults[0]);
    const csvContent = [
      headers.join(","),
      ...queryResults.map((row) =>
        headers
          .map((header) => `"${String(row[header]).replace(/"/g, '""')}"`)
          .join(",")
      ),
    ].join("\n");
    const blob = new Blob([`\uFEFF${csvContent}`], {
      type: "text/csv;charset=utf-8;",
    });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "query_results.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Pagination logic
  const totalPages = queryResults
    ? Math.ceil(queryResults.length / itemsPerPage)
    : 0;
  const paginatedResults = queryResults
    ? queryResults.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
      )
    : [];

  const tableNames = tables.map((t) => t.name);
  const allTablesSelected =
    tableNames.length > 0 && tableNames.length === selectedTables.length;

  // Enhanced sample queries with categories
  const sampleQueries = {
    "S2B 분석": [
      "2023년 가장많은 물품을 등록한 업체와 등록 건수는",
      "공급업체 수는",
      "교육기관 수는",
      "각 카테고리별 LEVEL 수를 분석해줘",
    ],
    "매출 분석": [
      "2023년 월별 매출 현황을 보여줘",
      "가장 많이 팔린 상품 상위 10개",
      "고객별 평생 구매 금액 순위",
      "분기별 매출 성장률은 어떻게 되나?",
    ],
    "고객 분석": [
      "신규 고객 가입 추이",
      "재구매율이 높은 고객 특성",
      "지역별 고객 분포 현황",
      "VIP 고객들의 구매 패턴",
    ],
    "운영 효율": [
      "배송이 지연된 주문 현황",
      "재고 부족 상품 리스트",
      "취소율이 높은 상품들",
      "피크 시간대 주문 분석",
    ],
  };

  // --- JSX Rendering ---
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="container mx-auto p-4 max-w-7xl">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
          {/* Enhanced Header */}
          <header className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                  <TrendingUp className="w-8 h-8" />
                  EasySQL
                </h1>
                <p className="text-blue-100 mt-2">
                  Advanced Natural Language to SQL Converter with Analytics
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="flex items-center gap-2 px-4 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors"
                >
                  <History className="w-4 h-4" />
                  History
                </button>
                <button
                  onClick={() => setShowFavorites(!showFavorites)}
                  className="flex items-center gap-2 px-4 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors"
                >
                  <Star className="w-4 h-4" />
                  Favorites
                </button>
              </div>
            </div>
          </header>

          {/* History Sidebar */}
          {showHistory && (
            <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-2xl z-50 overflow-y-auto border-l border-gray-200">
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <History className="w-5 h-5 text-gray-700" />
                    Query History
                    {queryHistory.length > 0 && (
                      <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-xs">
                        {queryHistory.length}
                      </span>
                    )}
                  </h3>
                  <div className="flex items-center gap-2">
                    {queryHistory.length > 0 && (
                      <button
                        onClick={clearAllHistory}
                        className="text-red-500 hover:text-red-700 text-sm font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors"
                        title="전체 삭제"
                      >
                        Clear All
                      </button>
                    )}
                    <button
                      onClick={() => setShowHistory(false)}
                      className="text-gray-400 hover:text-gray-600 p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
              <div className="p-4 space-y-3">
                {queryHistory.length === 0 ? (
                  <div className="text-center py-12">
                    <History className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-600 text-sm font-medium">
                      No history yet
                    </p>
                    <p className="text-gray-500 text-xs mt-1">
                      Your executed queries will appear here
                    </p>
                  </div>
                ) : (
                  queryHistory.map((item) => (
                    <div
                      key={item.id}
                      className="group p-3 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 relative"
                    >
                      <div
                        className="cursor-pointer"
                        onClick={() => loadFromHistory(item)}
                      >
                        <p className="text-sm font-medium text-gray-900 truncate pr-8">
                          {item.naturalLanguage}
                        </p>
                        <div className="flex items-center justify-between mt-2">
                          <p className="text-xs text-gray-700 font-medium">
                            {new Date(item.timestamp).toLocaleDateString()} •{" "}
                            {item.resultCount} rows
                          </p>
                          {item.executionTime && (
                            <p className="text-xs text-gray-600 font-medium">
                              {item.executionTime.toFixed(2)}s
                            </p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteHistoryItem(item.id);
                        }}
                        className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200"
                        title="삭제"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Favorites Sidebar */}
          {showFavorites && (
            <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-2xl z-50 overflow-y-auto border-l border-gray-200">
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Star className="w-5 h-5 text-yellow-600" />
                    Favorite Queries
                    {favoriteQueries.length > 0 && (
                      <span className="bg-yellow-100 text-yellow-600 px-2 py-1 rounded-full text-xs">
                        {favoriteQueries.length}
                      </span>
                    )}
                  </h3>
                  <div className="flex items-center gap-2">
                    {favoriteQueries.length > 0 && (
                      <button
                        onClick={clearAllFavorites}
                        className="text-red-500 hover:text-red-700 text-sm font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors"
                        title="전체 삭제"
                      >
                        Clear All
                      </button>
                    )}
                    <button
                      onClick={() => setShowFavorites(false)}
                      className="text-gray-400 hover:text-gray-600 p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
              <div className="p-4 space-y-3">
                {favoriteQueries.length === 0 ? (
                  <div className="text-center py-12">
                    <Star className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-600 text-sm font-medium">
                      No favorites yet
                    </p>
                    <p className="text-gray-500 text-xs mt-1">
                      Star queries to save them here
                    </p>
                  </div>
                ) : (
                  favoriteQueries.map((item) => (
                    <div
                      key={item.id}
                      className="group p-3 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 relative"
                    >
                      <div
                        className="cursor-pointer"
                        onClick={() => loadFromFavorites(item)}
                      >
                        <p className="text-sm font-medium text-gray-900 truncate pr-8">
                          {item.naturalLanguage}
                        </p>
                        <p className="text-xs text-gray-700 font-medium mt-2">
                          Added on{" "}
                          {new Date(item.timestamp).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteFavoriteItem(item.id);
                        }}
                        className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200"
                        title="삭제"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Enhanced Navigation */}
          <nav className="flex border-b border-gray-200 bg-gray-50">
            <button
              onClick={() => setActiveTab("settings")}
              className={`px-6 py-4 font-medium flex items-center gap-2 transition-all duration-200 ${
                activeTab === "settings"
                  ? "bg-white text-blue-600 border-b-2 border-blue-600 shadow-sm"
                  : "text-gray-600 hover:text-blue-600 hover:bg-white/50"
              }`}
            >
              ⚙️ Database Setup
            </button>
            <button
              onClick={() => setActiveTab("query")}
              className={`px-6 py-4 font-medium flex items-center gap-2 transition-all duration-200 ${
                activeTab === "query"
                  ? "bg-white text-blue-600 border-b-2 border-blue-600 shadow-sm"
                  : "text-gray-600 hover:text-blue-600 hover:bg-white/50"
              }`}
            >
              🔍 Query Builder
            </button>
          </nav>

          <main className="p-6">
            {activeTab === "settings" && (
              <section className="space-y-6">
                {/* Database Configuration Status */}
                <div className="bg-gradient-to-r from-slate-50 to-blue-50 border border-slate-200 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2 mb-4">
                    🔧 Current Database Configuration
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {(() => {
                      const dbInfo = getCurrentClientDbInfo();
                      return (
                        <>
                          <div className="bg-white rounded-lg p-4 border border-slate-100">
                            <div className="text-xs text-gray-600 mb-1 font-medium">
                              Host
                            </div>
                            <div className="text-sm font-mono text-slate-800">
                              {dbInfo.host}
                            </div>
                          </div>
                          <div className="bg-white rounded-lg p-4 border border-slate-100">
                            <div className="text-xs text-gray-600 mb-1 font-medium">
                              Port
                            </div>
                            <div className="text-sm font-mono text-slate-800">
                              {dbInfo.port}
                            </div>
                          </div>
                          <div className="bg-white rounded-lg p-4 border border-slate-100">
                            <div className="text-xs text-gray-600 mb-1 font-medium">
                              Database
                            </div>
                            <div className="text-sm font-mono text-slate-800">
                              {dbInfo.database}
                            </div>
                          </div>
                          <div className="bg-white rounded-lg p-4 border border-slate-100">
                            <div className="text-xs text-gray-600 mb-1 font-medium">
                              Username
                            </div>
                            <div className="text-sm font-mono text-slate-800">
                              {dbInfo.username}
                            </div>
                          </div>
                          <div className="bg-white rounded-lg p-4 border border-slate-100">
                            <div className="text-xs text-gray-600 mb-1 font-medium">
                              Driver
                            </div>
                            <div
                              className="text-sm font-mono text-slate-800 truncate"
                              title={dbInfo.driverClassName}
                            >
                              {dbInfo.driverClassName}
                            </div>
                          </div>
                          <div className="bg-white rounded-lg p-4 border border-slate-100">
                            <div className="text-xs text-gray-600 mb-1 font-medium">
                              Status
                            </div>
                            <div
                              className={`text-sm font-semibold ${
                                connectionStatus === "connected"
                                  ? "text-green-600"
                                  : connectionStatus === "error"
                                  ? "text-red-600"
                                  : "text-gray-500"
                              }`}
                            >
                              {connectionStatus === "connected"
                                ? "✅ Connected"
                                : connectionStatus === "error"
                                ? "❌ Error"
                                : "⏳ Not Connected"}
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Database URL
                    </label>
                    <input
                      type="text"
                      value={dbConfig.url}
                      onChange={(e) =>
                        setDbConfig({ ...dbConfig, url: e.target.value })
                      }
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-500 transition-all duration-200"
                      placeholder="jdbc:postgresql://localhost:5432/database_name"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Username
                    </label>
                    <input
                      type="text"
                      value={dbConfig.username}
                      onChange={(e) =>
                        setDbConfig({ ...dbConfig, username: e.target.value })
                      }
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-500 transition-all duration-200"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Password
                    </label>
                    <input
                      type="password"
                      value={dbConfig.password}
                      onChange={(e) =>
                        setDbConfig({ ...dbConfig, password: e.target.value })
                      }
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-500 transition-all duration-200"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Driver Class
                    </label>
                    <input
                      type="text"
                      value={dbConfig.driverClassName}
                      onChange={(e) =>
                        setDbConfig({
                          ...dbConfig,
                          driverClassName: e.target.value,
                        })
                      }
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-500 transition-all duration-200"
                      placeholder="org.postgresql.Driver"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <button
                    onClick={testConnection}
                    disabled={loading}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                  >
                    {loading ? "🔄" : "🗄️"} Test Connection
                  </button>

                  {connectionStatus === "connected" && (
                    <div className="flex items-center gap-2 text-green-600 bg-green-50 px-4 py-2 rounded-lg">
                      ✅ Connected Successfully
                    </div>
                  )}
                  {connectionStatus === "error" && (
                    <div className="flex items-center gap-2 text-red-600 bg-red-50 px-4 py-2 rounded-lg">
                      ❌ Connection Failed
                    </div>
                  )}
                </div>

                {/* Enhanced Table Selection */}
                {tables.length > 0 && (
                  <div className="bg-gray-50 rounded-xl p-6">
                    <div className="flex justify-between items-center mb-4">
                      <label className="block text-lg font-semibold text-gray-700">
                        Select Tables 📋
                      </label>
                      <button
                        onClick={handleSelectAllToggle}
                        className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors px-4 py-2 bg-white rounded-lg shadow-sm"
                      >
                        {allTablesSelected ? "Deselect All" : "Select All"}
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {tables.map((table) => (
                        <div
                          key={table.name}
                          className={`p-4 rounded-lg border-2 transition-all duration-200 cursor-pointer ${
                            selectedTables.includes(table.name)
                              ? "border-blue-500 bg-blue-50"
                              : "border-gray-200 bg-white hover:border-gray-300"
                          }`}
                          onClick={() => handleTableSelection(table.name)}
                        >
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={selectedTables.includes(table.name)}
                              onChange={() => handleTableSelection(table.name)}
                              className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <div className="flex-1">
                              <h4 className="font-semibold text-gray-900">
                                {table.name}
                              </h4>
                              {table.comment && (
                                <p className="text-sm text-gray-600 mt-1">
                                  {table.comment}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Schema Details */}
                {selectedTables.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-700">
                      Schema Details
                    </h3>
                    {selectedTables.map((tableName) => {
                      const tableInfo = tables.find(
                        (t) => t.name === tableName
                      );
                      const columns = tableSchema[tableName] || [];
                      return (
                        <div
                          key={tableName}
                          className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm"
                        >
                          <div className="flex items-center gap-3 mb-4">
                            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                            <h4 className="font-semibold text-gray-800 text-lg">
                              {tableName}
                            </h4>
                          </div>
                          {tableInfo?.comment && (
                            <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                              <p className="text-sm text-blue-800">
                                {tableInfo.comment}
                              </p>
                            </div>
                          )}
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {columns.map((column) => (
                              <div
                                key={column.name}
                                className="p-3 bg-gray-50 rounded-lg"
                              >
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-mono text-sm font-semibold text-indigo-600">
                                    {column.name}
                                  </span>
                                  <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded">
                                    {column.type}
                                  </span>
                                  {!column.nullable && (
                                    <span className="text-xs text-red-600 font-semibold">
                                      NOT NULL
                                    </span>
                                  )}
                                </div>
                                {column.comment && (
                                  <p className="text-xs text-gray-600 mt-1">
                                    {column.comment}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {activeTab === "query" && (
              <section className="space-y-6">
                {selectedTables.length === 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
                    <div className="flex items-center gap-3 text-amber-800">
                      ⚠️ Please select one or more tables in the Database Setup
                      tab first.
                    </div>
                  </div>
                )}

                {/* Enhanced LLM Status */}
                {llmStatus && (
                  <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-purple-800 flex items-center gap-2">
                        🤖 AI Engine Status
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            llmStatus.isGemini
                              ? "bg-blue-100 text-blue-800"
                              : "bg-green-100 text-green-800"
                          }`}
                        >
                          {llmStatus.isGemini ? "🌟 GEMINI" : "🏠 LOCAL"}
                        </span>
                      </h3>
                      <button
                        onClick={fetchLlmStatus}
                        className="text-sm text-purple-600 hover:text-purple-800 underline flex items-center gap-1"
                      >
                        🔄 Refresh
                      </button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-white rounded-lg p-4 border border-purple-100">
                        <div className="text-xs text-gray-600 mb-1 font-medium">
                          Model
                        </div>
                        <div
                          className="text-sm font-mono text-purple-800 truncate"
                          title={llmStatus.model}
                        >
                          {llmStatus.model}
                        </div>
                      </div>
                      <div className="bg-white rounded-lg p-4 border border-purple-100">
                        <div className="text-xs text-gray-600 mb-1 font-medium">
                          {llmStatus.isGemini ? "API Status" : "Server"}
                        </div>
                        <div className="text-sm font-mono text-purple-800 truncate">
                          {llmStatus.isGemini
                            ? llmStatus.geminiConfigured
                              ? "✅ Configured"
                              : "❌ Not Set"
                            : llmStatus.lmStudioUrl.replace("http://", "")}
                        </div>
                      </div>
                      <div className="bg-white rounded-lg p-4 border border-purple-100">
                        <div className="text-xs text-gray-600 mb-1 font-medium">
                          Analysis Mode
                        </div>
                        <div
                          className={`text-sm font-semibold flex items-center gap-1 ${
                            llmStatus.thinkEnabled
                              ? "text-green-600"
                              : "text-gray-500"
                          }`}
                        >
                          {llmStatus.thinkEnabled ? "🧠 Deep" : "⚡ Fast"}
                        </div>
                      </div>
                      <div className="bg-white rounded-lg p-4 border border-purple-100">
                        <div className="text-xs text-gray-600 mb-1 font-medium">
                          Streaming
                        </div>
                        <div
                          className={`text-sm font-semibold flex items-center gap-1 ${
                            llmStatus.streamEnabled
                              ? "text-green-600"
                              : "text-gray-500"
                          }`}
                        >
                          {llmStatus.isGemini && llmStatus.thinkEnabled
                            ? "⚠️ N/A"
                            : llmStatus.streamEnabled
                            ? "🔄 ON"
                            : "⏸️ OFF"}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Enhanced Query Input */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="block text-lg font-semibold text-gray-700">
                      Natural Language Query
                    </label>
                    {naturalLanguage && editableSQL && (
                      <button
                        onClick={() =>
                          toggleFavorite(naturalLanguage, editableSQL)
                        }
                        className={`flex items-center gap-2 px-3 py-1 rounded-lg transition-colors ${
                          isFavorite(naturalLanguage, editableSQL)
                            ? "text-yellow-600 bg-yellow-50 border border-yellow-200"
                            : "text-gray-600 bg-gray-50 border border-gray-200"
                        }`}
                      >
                        {isFavorite(naturalLanguage, editableSQL) ? (
                          <Star className="w-4 h-4 fill-current" />
                        ) : (
                          <StarOff className="w-4 h-4" />
                        )}
                        {isFavorite(naturalLanguage, editableSQL)
                          ? "Favorited"
                          : "Add to Favorites"}
                      </button>
                    )}
                  </div>

                  <textarea
                    value={naturalLanguage}
                    onChange={(e) => setNaturalLanguage(e.target.value)}
                    className="w-full px-4 py-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-500 transition-all duration-200 resize-none"
                    rows="4"
                    placeholder="예: '2023년에 가장 많이 주문한 고객 상위 10명을 보여주세요'"
                    disabled={selectedTables.length === 0}
                  />

                  {/* Enhanced Sample Queries */}
                  <div className="space-y-4">
                    <p className="text-sm font-medium text-gray-600">
                      Quick Start Templates:
                    </p>
                    <div className="space-y-3">
                      {Object.entries(sampleQueries).map(
                        ([category, queries]) => (
                          <div key={category} className="space-y-2">
                            <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                              {category}
                            </h4>
                            <div className="flex flex-wrap gap-2">
                              {queries.map((sample, index) => (
                                <button
                                  key={index}
                                  onClick={() => setNaturalLanguage(sample)}
                                  disabled={selectedTables.length === 0}
                                  className="px-4 py-2 text-sm bg-gradient-to-r from-gray-50 to-gray-100 hover:from-blue-50 hover:to-indigo-50 text-gray-700 hover:text-blue-700 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed border border-gray-200 hover:border-blue-300"
                                >
                                  {sample}
                                </button>
                              ))}
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </div>

                  <button
                    onClick={convertToSQL}
                    disabled={
                      loading ||
                      selectedTables.length === 0 ||
                      !naturalLanguage.trim()
                    }
                    className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-8 py-4 rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all duration-200 flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg font-semibold"
                  >
                    {loading && isStreaming ? "🧠" : "✨"} Generate SQL
                    {llmStatus && (
                      <span className="text-sm opacity-90 bg-white/20 px-2 py-1 rounded">
                        {llmStatus.thinkEnabled ? "Deep Analysis" : "Fast Mode"}
                      </span>
                    )}
                  </button>
                </div>

                {/* Enhanced AI Reasoning */}
                {(loading || llmThinking) && (
                  <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                    <button
                      onClick={() => setIsReasoningOpen(!isReasoningOpen)}
                      className="w-full flex justify-between items-center p-4 bg-gradient-to-r from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100 transition-all duration-200"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center">
                          <span className="text-white text-sm">🧠</span>
                        </div>
                        <div className="text-left">
                          <span className="font-semibold text-gray-800">
                            AI Analysis Process
                          </span>
                          <p className="text-sm text-gray-600">
                            {llmStatus &&
                              `${llmStatus.model} ${
                                llmStatus.thinkEnabled
                                  ? "• Deep Reasoning"
                                  : "• Direct Generation"
                              }`}
                          </p>
                        </div>
                        {isStreaming && (
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            <span className="text-sm text-green-600 font-medium">
                              Live
                            </span>
                          </div>
                        )}
                      </div>
                      <ChevronDown
                        className={`w-5 h-5 text-gray-500 transition-transform ${
                          isReasoningOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    {!isReasoningOpen && llmThinking && (
                      <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
                        <p className="text-sm text-gray-700 italic truncate">
                          {getLastLine(llmThinking)}
                          {isStreaming && (
                            <span className="inline-block w-2 h-4 bg-indigo-600 animate-pulse ml-2"></span>
                          )}
                        </p>
                      </div>
                    )}

                    {isReasoningOpen && (
                      <div className="p-4 border-t border-gray-200 max-h-80 overflow-y-auto bg-white">
                        <pre className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap font-sans">
                          {llmThinking}
                          {isStreaming && (
                            <span className="inline-block w-2 h-4 bg-indigo-600 animate-pulse ml-1"></span>
                          )}
                        </pre>
                      </div>
                    )}
                  </div>
                )}

                {/* Enhanced SQL Editor */}
                {generatedSQL && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <label className="text-lg font-semibold text-gray-700 flex items-center gap-2">
                          🗄️ Generated SQL Query
                        </label>
                        {sqlConversionTime !== null && (
                          <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                            Generated in {sqlConversionTime.toFixed(2)}s
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          id="copy-sql-button"
                          onClick={copySQL}
                          className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors shadow-sm"
                        >
                          <Copy className="w-4 h-4" />
                          Copy
                        </button>
                        <button
                          onClick={executeSQL}
                          disabled={loading}
                          className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-sm"
                        >
                          <Play className="w-4 h-4" />
                          Execute
                        </button>
                        {queryResults && queryResults.length > 0 && (
                          <button
                            onClick={() => analyzePerformance(editableSQL)}
                            disabled={isAnalyzing}
                            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 shadow-sm"
                          >
                            <Zap className="w-4 h-4" />
                            Analyze
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden shadow-inner">
                      <textarea
                        value={editableSQL}
                        onChange={(e) => setEditableSQL(e.target.value)}
                        className="w-full h-64 bg-slate-900 text-slate-100 p-6 font-mono text-sm border-none rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none leading-relaxed"
                        spellCheck="false"
                      />
                    </div>
                  </div>
                )}

                {/* Enhanced Results Section */}
                {queryResults !== null && (
                  <div className="space-y-6">
                    {queryResults.length > 0 ? (
                      <>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <h3 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                              📊 Query Results
                              <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                                {queryResults.length} rows
                              </span>
                            </h3>
                            {queryExecutionTime !== null && (
                              <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                                Executed in {queryExecutionTime.toFixed(2)}s
                              </span>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() =>
                                setShowVisualization(!showVisualization)
                              }
                              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                            >
                              <BarChart3 className="w-4 h-4" />
                              {showVisualization ? "Hide Chart" : "Show Chart"}
                            </button>
                            <button
                              onClick={downloadResults}
                              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm"
                            >
                              <Download className="w-4 h-4" />
                              Export CSV
                            </button>
                          </div>
                        </div>

                        {/* Visualization Panel */}
                        {showVisualization && (
                          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                              <h4 className="font-semibold text-gray-800">
                                Data Visualization
                              </h4>
                              <div className="flex gap-2">
                                {["bar", "line", "pie"].map((type) => (
                                  <button
                                    key={type}
                                    onClick={() => setChartType(type)}
                                    className={`px-3 py-1 rounded text-sm transition-colors ${
                                      chartType === type
                                        ? "bg-indigo-600 text-white"
                                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                    }`}
                                  >
                                    {type.charAt(0).toUpperCase() +
                                      type.slice(1)}
                                  </button>
                                ))}
                              </div>
                            </div>
                            {renderVisualization()}
                          </div>
                        )}

                        {/* Enhanced Results Table */}
                        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                          {/* Pagination Controls */}
                          {totalPages > 1 && (
                            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
                              <span className="text-sm text-gray-600">
                                Showing {(currentPage - 1) * itemsPerPage + 1}{" "}
                                to{" "}
                                {Math.min(
                                  currentPage * itemsPerPage,
                                  queryResults.length
                                )}{" "}
                                of {queryResults.length} results
                              </span>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() =>
                                    setCurrentPage(Math.max(1, currentPage - 1))
                                  }
                                  disabled={currentPage === 1}
                                  className="p-2 text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <ChevronLeft className="w-4 h-4" />
                                </button>
                                <span className="px-3 py-1 bg-white border border-gray-300 rounded text-sm font-medium">
                                  {currentPage} of {totalPages}
                                </span>
                                <button
                                  onClick={() =>
                                    setCurrentPage(
                                      Math.min(totalPages, currentPage + 1)
                                    )
                                  }
                                  disabled={currentPage === totalPages}
                                  className="p-2 text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <ChevronRight className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          )}

                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                                <tr>
                                  {Object.keys(queryResults[0]).map(
                                    (header) => (
                                      <th
                                        key={header}
                                        scope="col"
                                        className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider"
                                      >
                                        <div className="space-y-1">
                                          <div>{header}</div>
                                          {columnTranslations[header] && (
                                            <div className="text-xs font-medium text-indigo-600 normal-case">
                                              {columnTranslations[header]}
                                            </div>
                                          )}
                                        </div>
                                      </th>
                                    )
                                  )}
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                {paginatedResults.map((row, index) => (
                                  <tr
                                    key={index}
                                    className="hover:bg-gray-50 transition-colors"
                                  >
                                    {Object.values(row).map(
                                      (cell, cellIndex) => (
                                        <td
                                          key={cellIndex}
                                          className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                                        >
                                          {typeof cell === "number"
                                            ? cell.toLocaleString()
                                            : String(cell)}
                                        </td>
                                      )
                                    )}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
                        <div className="flex items-center gap-3 text-blue-800">
                          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                            <span className="text-white text-sm">✓</span>
                          </div>
                          <div>
                            <p className="font-semibold">
                              Query executed successfully
                            </p>
                            <p className="text-sm">
                              No rows returned. Try adjusting your filters or
                              query conditions.
                              {queryExecutionTime !== null && (
                                <span className="ml-2">
                                  (Executed in {queryExecutionTime.toFixed(2)}s)
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Enhanced Performance Analysis */}
                {performanceAnalysis && (
                  <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-purple-800 flex items-center gap-2 mb-4">
                      <Zap className="w-5 h-5" />
                      Performance Optimization Guide
                    </h3>
                    <div className="prose prose-sm max-w-none text-purple-900 leading-relaxed">
                      <Markdown>{performanceAnalysis}</Markdown>
                    </div>
                  </div>
                )}

                {/* Enhanced Error Display */}
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-6">
                    <div className="flex items-start gap-3 text-red-800">
                      <div className="w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-white text-sm">!</span>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold mb-2">Error Occurred</h4>
                        <pre className="whitespace-pre-wrap text-sm font-sans leading-relaxed">
                          {error}
                        </pre>
                      </div>
                    </div>
                  </div>
                )}
              </section>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

export default NaturalLanguageToSQL;
