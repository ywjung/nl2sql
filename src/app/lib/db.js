import { Pool } from "pg";

// 환경 변수에서 데이터베이스 설정 로드
const DB_CONFIG = {
  user: process.env.DB_USER || "",
  host: process.env.DB_HOST || "",
  database: process.env.DB_NAME || "",
  password: process.env.DB_PASSWORD || "",
  port: parseInt(process.env.DB_PORT, 10) || 5432,
};

// 기본 풀 설정 (환경변수 기반)
const defaultPool = new Pool({
  ...DB_CONFIG,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
  max: parseInt(process.env.DB_MAX_CONNECTIONS, 10) || 20, // 최대 연결 수
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT, 10) || 30000, // 유휴 타임아웃
  connectionTimeoutMillis:
    parseInt(process.env.DB_CONNECTION_TIMEOUT, 10) || 2000, // 연결 타임아웃
});

// 동적 설정을 위한 변수들
let currentDbConfig = null;
let dynamicPool = null;

/**
 * 환경 변수에서 데이터베이스 설정을 가져옵니다
 * @returns {Object} 데이터베이스 설정 객체
 */
export function getEnvDbConfig() {
  return {
    url:
      process.env.DB_URL ||
      `jdbc:postgresql://${DB_CONFIG.host}:${DB_CONFIG.port}/${DB_CONFIG.database}`,
    username: DB_CONFIG.user,
    password: DB_CONFIG.password,
    driverClassName: process.env.DB_DRIVER || "org.postgresql.Driver",
    host: DB_CONFIG.host,
    port: DB_CONFIG.port,
    database: DB_CONFIG.database,
  };
}

/**
 * 데이터베이스 설정을 업데이트합니다
 * @param {Object} config - 데이터베이스 설정 객체 (JDBC URL 포함)
 */
export function setDbConfig(config) {
  // 기존 동적 풀이 있으면 종료
  if (dynamicPool) {
    dynamicPool.end().catch((err) => {
      console.error("동적 풀 종료 중 오류:", err);
    });
    dynamicPool = null;
  }

  currentDbConfig = config;
  console.log("데이터베이스 설정이 업데이트되었습니다:", {
    url: config.url,
    username: config.username,
    // password는 로그에 출력하지 않음 (보안)
  });
}

/**
 * 현재 설정으로 데이터베이스 연결을 반환합니다
 * @returns {Pool} PostgreSQL 연결 풀
 */
export async function getDb() {
  // 동적 설정이 없으면 기본 풀 반환
  if (!currentDbConfig) {
    console.log("기본 데이터베이스 풀 사용:", {
      host: DB_CONFIG.host,
      port: DB_CONFIG.port,
      database: DB_CONFIG.database,
      user: DB_CONFIG.user,
    });
    return defaultPool;
  }

  // 기존 동적 풀이 있으면 재사용
  if (dynamicPool) {
    return dynamicPool;
  }

  // JDBC URL을 PostgreSQL 연결 정보로 파싱
  const { host, port, database } = parseJdbcUrl(currentDbConfig.url);

  // 새로운 동적 풀 생성
  dynamicPool = new Pool({
    host,
    port,
    database,
    user: currentDbConfig.username,
    password: currentDbConfig.password,
    ssl:
      process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : false,
    max: parseInt(process.env.DB_MAX_CONNECTIONS, 10) || 20, // 최대 연결 수
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT, 10) || 30000, // 유휴 타임아웃
    connectionTimeoutMillis:
      parseInt(process.env.DB_CONNECTION_TIMEOUT, 10) || 2000, // 연결 타임아웃
  });

  // 연결 테스트
  try {
    const client = await dynamicPool.connect();
    client.release();
    console.log("동적 데이터베이스 연결 성공:", {
      host,
      port,
      database,
      user: currentDbConfig.username,
    });
  } catch (error) {
    console.error("동적 데이터베이스 연결 실패:", error);

    // 실패한 풀 정리
    if (dynamicPool) {
      await dynamicPool.end().catch((err) => {
        console.error("실패한 풀 정리 중 오류:", err);
      });
      dynamicPool = null;
    }

    throw error;
  }

  return dynamicPool;
}

/**
 * JDBC URL을 파싱하여 PostgreSQL 연결 정보를 추출합니다
 * @param {string} jdbcUrl - JDBC URL (예: jdbc:postgresql://localhost:5432/mydb)
 * @returns {Object} 파싱된 연결 정보
 */
function parseJdbcUrl(jdbcUrl) {
  try {
    // jdbc:postgresql://host:port/database 형태의 URL 파싱
    const urlPattern = /^jdbc:postgresql:\/\/([^:/?]+):(\d+)\/([^?]+)(\?.*)?$/;
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

    return {
      host,
      port,
      database,
    };
  } catch (error) {
    console.error("JDBC URL 파싱 오류:", error);
    throw new Error(`JDBC URL 파싱 실패: ${error.message}`);
  }
}

/**
 * 데이터베이스 연결 상태를 확인합니다
 * @param {Pool} pool - 확인할 연결 풀 (선택사항)
 * @returns {Promise<boolean>} 연결 상태
 */
export async function checkDbConnection(pool = null) {
  const targetPool = pool || (await getDb());

  try {
    const client = await targetPool.connect();
    await client.query("SELECT 1");
    client.release();
    return true;
  } catch (error) {
    console.error("데이터베이스 연결 상태 확인 실패:", error);
    return false;
  }
}

/**
 * 현재 데이터베이스 설정 정보를 반환합니다 (비밀번호 제외)
 * @returns {Object} 데이터베이스 설정 정보
 */
export function getCurrentDbInfo() {
  if (currentDbConfig) {
    const { host, port, database } = parseJdbcUrl(currentDbConfig.url);
    return {
      type: "dynamic",
      host,
      port,
      database,
      username: currentDbConfig.username,
      driverClassName: currentDbConfig.driverClassName,
    };
  }

  return {
    type: "default",
    host: DB_CONFIG.host,
    port: DB_CONFIG.port,
    database: DB_CONFIG.database,
    username: DB_CONFIG.user,
    driverClassName: process.env.DB_DRIVER || "org.postgresql.Driver",
  };
}

/**
 * 모든 데이터베이스 연결을 종료합니다
 */
export async function closeDb() {
  const closePromises = [];

  if (dynamicPool) {
    console.log("동적 데이터베이스 풀 종료 중...");
    closePromises.push(
      dynamicPool
        .end()
        .then(() => {
          console.log("동적 데이터베이스 연결이 종료되었습니다.");
          dynamicPool = null;
        })
        .catch((err) => {
          console.error("동적 풀 종료 중 오류:", err);
        })
    );
  }

  if (defaultPool) {
    console.log("기본 데이터베이스 풀 종료 중...");
    closePromises.push(
      defaultPool
        .end()
        .then(() => {
          console.log("기본 데이터베이스 연결이 종료되었습니다.");
        })
        .catch((err) => {
          console.error("기본 풀 종료 중 오류:", err);
        })
    );
  }

  if (closePromises.length > 0) {
    await Promise.allSettled(closePromises);
  }

  // 현재 설정 초기화
  currentDbConfig = null;
}

/**
 * 애플리케이션 종료 시 데이터베이스 연결 정리
 */
process.on("SIGINT", async () => {
  console.log("애플리케이션 종료 신호 감지. 데이터베이스 연결을 정리합니다...");
  await closeDb();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("애플리케이션 종료 신호 감지. 데이터베이스 연결을 정리합니다...");
  await closeDb();
  process.exit(0);
});

// 기본 풀을 default export로 유지 (기존 코드 호환성)
export default defaultPool;
