import { runQuery } from "../../lib/snowflake";

interface DiscountRateData {
  sale_ym: string;
  channel: string;
  discount_rate: number;
}

export default async function handler(req, res) {
  try {
    // 브랜드 파라미터: X=Discovery, M=MLB, I=MLB KIDS
    const { brand = 'X', year = '2025' } = req.query;
    const brandCode = ['X', 'M', 'I'].includes(brand) ? brand : 'X';
    const selectedYear = ['2023', '2024', '2025'].includes(year) ? year : '2025';
    
    // 연도별 종료월 결정
    let endMonth = '12';
    if (selectedYear === '2025' && (brandCode === 'M' || brandCode === 'I')) {
      endMonth = '11'; // MLB, MLB KIDS는 2025년 11월까지만
    }
    
    const sql = `
      WITH base AS (
        SELECT
              TO_CHAR(s.sale_dt, 'YYYY-MM') AS sale_ym
            , m.fr_or_cls AS channel
            , SUM(s.sale_amt) AS sale_amt_sum
            , SUM(s.tag_amt) AS tag_amt_sum
        FROM chn.dw_sale s
        JOIN FNF.CHN.MST_SHOP_ALL m
          ON s.shop_id = m.shop_id
        WHERE 1 = 1
          AND s.brd_cd = '${brandCode}'
          AND s.sale_dt >= '${selectedYear}-01-01'
          AND s.sale_dt <= '${selectedYear}-${endMonth}-31'
          AND s.tag_amt > 0
          AND m.anlys_onoff_cls_nm = 'Offline'
          AND m.anlys_shop_type_nm IN ('FO', 'FP')
          AND m.fr_or_cls IN ('FR', 'OR')
        GROUP BY
              TO_CHAR(s.sale_dt, 'YYYY-MM')
            , m.fr_or_cls
      )
      SELECT
            sale_ym
          , channel
          , CASE 
              WHEN tag_amt_sum > 0 THEN 1 - (sale_amt_sum / tag_amt_sum)
              ELSE 0
            END AS discount_rate
      FROM base
      ORDER BY sale_ym, channel
    `;

    const rows = await runQuery(sql) as any[];

    // 컬럼명 정규화 (Snowflake는 대문자로 반환할 수 있음)
    const normalizedRows: DiscountRateData[] = rows.map((row: any) => ({
      sale_ym: row.SALE_YM || row.sale_ym || '',
      channel: row.CHANNEL || row.channel || '',
      discount_rate: Number(row.DISCOUNT_RATE || row.discount_rate || 0)
    }));

    res.status(200).json(normalizedRows);
  } catch (e) {
    console.error("Error fetching discount rate:", e);
    const errorMessage = e instanceof Error ? e.message : String(e);
    console.error("Full error:", e);
    res.status(500).json({ 
      error: errorMessage,
      details: e instanceof Error ? e.stack : undefined
    });
  }
}






