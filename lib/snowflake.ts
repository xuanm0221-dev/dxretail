import snowflake from "snowflake-sdk";

// 타입 안전하게 하기 위한 래핑 타입 (경고 제거용)
type SnowflakeConnOptions = snowflake.ConnectionOptions & {
  account: string;
  username: string;
  password: string;
  warehouse: string;
  database: string;
  schema: string;
  role: string;
};

export function runQuery(sql: string): Promise<any[]> {
  const connection = snowflake.createConnection({
    account: process.env.SNOWFLAKE_ACCOUNT as string,
    username: process.env.SNOWFLAKE_USER as string,
    password: process.env.SNOWFLAKE_PASSWORD as string,
    warehouse: process.env.SNOWFLAKE_WAREHOUSE as string,
    database: process.env.SNOWFLAKE_DATABASE as string,
    schema: process.env.SNOWFLAKE_SCHEMA as string,
    role: process.env.SNOWFLAKE_ROLE as string
  } as SnowflakeConnOptions);

  return new Promise<any[]>((resolve, reject) => {
    connection.connect(err => {
      if (err) {
        reject(err);
        return;
      }

      connection.execute({
        sqlText: sql,
        complete: (err, _stmt, rows) => {
          if (err) {
            reject(err);
            return;
          }
          // rows 가 undefined 로 잡히는 타입 경고 방지
          resolve((rows || []) as any[]);
        }
      });
    });
  });
}
