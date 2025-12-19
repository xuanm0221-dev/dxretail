import { runQuery } from "../../lib/snowflake";

interface SummaryRow {
  row_name: string;
  fr_or_cls: string;
  m01: number | null;
  m02: number | null;
  m03: number | null;
  m04: number | null;
  m05: number | null;
  m06: number | null;
  m07: number | null;
  m08: number | null;
  m09: number | null;
  m10: number | null;
  m11: number | null;
  m12: number | null;
}

interface DetailRow {
  fr_or_cls: string;
  shop_id: string;
  shop_name: string;
  open_ym: string | null;
  m01: number | null;
  m02: number | null;
  m03: number | null;
  m04: number | null;
  m05: number | null;
  m06: number | null;
  m07: number | null;
  m08: number | null;
  m09: number | null;
  m10: number | null;
  m11: number | null;
  m12: number | null;
  city_nm: string | null;
  city_tier_nm: string | null;
  shop_level_nm: string | null;
  sale_region_nm: string | null;
  mono_multi_cd: number | null;
}

export default async function handler(req, res) {
  try {
    const { brand = 'X', year = '2025' } = req.query;
    const brandCode = ['X', 'M', 'I'].includes(brand) ? brand : 'X';
    const selectedYear = ['2023', '2024', '2025'].includes(year) ? year : '2025';
    
    // 연도별 YYMM 범위 결정
    const yymmFrom = `${selectedYear}01`;
    const yymmTo = (selectedYear === '2025' && (brandCode === 'M' || brandCode === 'I')) 
      ? `${selectedYear}11` 
      : `${selectedYear}12`;

    // 요약 행 쿼리
    const summarySql = `
WITH shop_map AS (
  SELECT
      oa_map_shop_id, shop_id, oa_shop_id, fr_or_cls, brd_cd, anlys_shop_type_nm, open_dt
  FROM chn.dw_shop_wh_detail
  WHERE brd_cd = '${brandCode}'
    AND anlys_shop_type_nm IN ('FP','FO')
  QUALIFY ROW_NUMBER() OVER (
    PARTITION BY oa_map_shop_id
    ORDER BY open_dt DESC NULLS LAST
  ) = 1
),
base AS (
  SELECT
      a.yymm,
      m.fr_or_cls,
      m.shop_id,
      SUM(a.sale_amt) AS sale_amt
  FROM chn.dm_sh_s_m a
  JOIN shop_map m
    ON a.shop_id = m.oa_map_shop_id
  JOIN chn.mst_shop_all c
    ON m.shop_id = c.shop_id
  WHERE a.yymm BETWEEN '${yymmFrom}' AND '${yymmTo}'
    AND c.anlys_onoff_cls_cd = '1'
  GROUP BY 1,2,3
),
month_agg AS (
  SELECT
      yymm,
      fr_or_cls,
      SUM(sale_amt) AS sale_amt_total,
      COUNT_IF(sale_amt > 0) AS shop_cnt,
      CASE WHEN COUNT_IF(sale_amt > 0)=0 THEN NULL
           ELSE SUM(sale_amt)/COUNT_IF(sale_amt > 0)
      END AS shop_by_sale_amt
  FROM base
  GROUP BY 1,2
),
metric_rows AS (
  SELECT fr_or_cls, 'TOTAL' metric, yymm, sale_amt_total val FROM month_agg
  UNION ALL
  SELECT fr_or_cls, 'AVG' metric, yymm, shop_by_sale_amt val FROM month_agg
  UNION ALL
  SELECT fr_or_cls, 'CNT' metric, yymm, shop_cnt val FROM month_agg
)
SELECT
  CASE
    WHEN fr_or_cls='FR' AND metric='TOTAL' THEN '대리상 총실판'
    WHEN fr_or_cls='FR' AND metric='AVG' THEN '대리상 점당매출'
    WHEN fr_or_cls='FR' AND metric='CNT' THEN '대리상 매장수'
    WHEN fr_or_cls='OR' AND metric='TOTAL' THEN '직영 총실판'
    WHEN fr_or_cls='OR' AND metric='AVG' THEN '직영 점당매출'
    WHEN fr_or_cls='OR' AND metric='CNT' THEN '직영 매장수'
  END AS row_name,
  fr_or_cls,
  MAX(CASE WHEN SUBSTR(yymm,5,2)='01' THEN val END) AS m01,
  MAX(CASE WHEN SUBSTR(yymm,5,2)='02' THEN val END) AS m02,
  MAX(CASE WHEN SUBSTR(yymm,5,2)='03' THEN val END) AS m03,
  MAX(CASE WHEN SUBSTR(yymm,5,2)='04' THEN val END) AS m04,
  MAX(CASE WHEN SUBSTR(yymm,5,2)='05' THEN val END) AS m05,
  MAX(CASE WHEN SUBSTR(yymm,5,2)='06' THEN val END) AS m06,
  MAX(CASE WHEN SUBSTR(yymm,5,2)='07' THEN val END) AS m07,
  MAX(CASE WHEN SUBSTR(yymm,5,2)='08' THEN val END) AS m08,
  MAX(CASE WHEN SUBSTR(yymm,5,2)='09' THEN val END) AS m09,
  MAX(CASE WHEN SUBSTR(yymm,5,2)='10' THEN val END) AS m10,
  MAX(CASE WHEN SUBSTR(yymm,5,2)='11' THEN val END) AS m11,
  MAX(CASE WHEN SUBSTR(yymm,5,2)='12' THEN val END) AS m12
FROM metric_rows
GROUP BY 1,2
ORDER BY
  CASE row_name
    WHEN '대리상 총실판' THEN 1
    WHEN '대리상 점당매출' THEN 2
    WHEN '대리상 매장수' THEN 3
    WHEN '직영 총실판' THEN 4
    WHEN '직영 점당매출' THEN 5
    WHEN '직영 매장수' THEN 6
    ELSE 99
  END
`;

    // 상세 행 쿼리
    const detailSql = `
WITH shop_map AS (
  SELECT
      oa_map_shop_id, shop_id, fr_or_cls, brd_cd, open_dt
  FROM chn.dw_shop_wh_detail
  WHERE brd_cd = '${brandCode}'
    AND anlys_shop_type_nm IN ('FP','FO')
  QUALIFY ROW_NUMBER() OVER (
    PARTITION BY oa_map_shop_id
    ORDER BY open_dt DESC NULLS LAST
  ) = 1
),
base AS (
  SELECT
      a.yymm,
      m.fr_or_cls,
      m.shop_id,
      c.shop_nm_en,
      c.shop_nm_cn,
      TO_CHAR(m.open_dt, 'YY.MM') AS open_ym,
      c.city_nm,
      c.city_tier_nm,
      c.shop_level_nm,
      c.sale_region_nm,
      c.mono_multi_cd,
      SUM(a.sale_amt) AS sale_amt
  FROM chn.dm_sh_s_m a
  JOIN shop_map m
    ON a.shop_id = m.oa_map_shop_id
  JOIN chn.mst_shop_all c
    ON m.shop_id = c.shop_id
  WHERE a.yymm BETWEEN '${yymmFrom}' AND '${yymmTo}'
    AND c.anlys_onoff_cls_cd = '1'
  GROUP BY 1,2,3,4,5,6,7,8,9,10,11
)
SELECT
  fr_or_cls,
  shop_id,
  COALESCE(NULLIF(shop_nm_en,''), shop_nm_cn) AS shop_name,
  open_ym,
  city_nm,
  city_tier_nm,
  shop_level_nm,
  sale_region_nm,
  mono_multi_cd,
  MAX(CASE WHEN SUBSTR(yymm,5,2)='01' THEN sale_amt END) AS m01,
  MAX(CASE WHEN SUBSTR(yymm,5,2)='02' THEN sale_amt END) AS m02,
  MAX(CASE WHEN SUBSTR(yymm,5,2)='03' THEN sale_amt END) AS m03,
  MAX(CASE WHEN SUBSTR(yymm,5,2)='04' THEN sale_amt END) AS m04,
  MAX(CASE WHEN SUBSTR(yymm,5,2)='05' THEN sale_amt END) AS m05,
  MAX(CASE WHEN SUBSTR(yymm,5,2)='06' THEN sale_amt END) AS m06,
  MAX(CASE WHEN SUBSTR(yymm,5,2)='07' THEN sale_amt END) AS m07,
  MAX(CASE WHEN SUBSTR(yymm,5,2)='08' THEN sale_amt END) AS m08,
  MAX(CASE WHEN SUBSTR(yymm,5,2)='09' THEN sale_amt END) AS m09,
  MAX(CASE WHEN SUBSTR(yymm,5,2)='10' THEN sale_amt END) AS m10,
  MAX(CASE WHEN SUBSTR(yymm,5,2)='11' THEN sale_amt END) AS m11,
  MAX(CASE WHEN SUBSTR(yymm,5,2)='12' THEN sale_amt END) AS m12
FROM base
GROUP BY 1,2,3,4,5,6,7,8,9
ORDER BY fr_or_cls, shop_name
`;

    // 두 쿼리 실행
    const [summaryRawRows, detailRawRows] = await Promise.all([
      runQuery(summarySql),
      runQuery(detailSql)
    ]);

    // 컬럼명 정규화 (Snowflake는 대문자로 반환)
    const summaryRows: SummaryRow[] = (summaryRawRows as any[]).map((row: any) => ({
      row_name: row.ROW_NAME || row.row_name || '',
      fr_or_cls: row.FR_OR_CLS || row.fr_or_cls || '',
      m01: row.M01 ?? row.m01 ?? null,
      m02: row.M02 ?? row.m02 ?? null,
      m03: row.M03 ?? row.m03 ?? null,
      m04: row.M04 ?? row.m04 ?? null,
      m05: row.M05 ?? row.m05 ?? null,
      m06: row.M06 ?? row.m06 ?? null,
      m07: row.M07 ?? row.m07 ?? null,
      m08: row.M08 ?? row.m08 ?? null,
      m09: row.M09 ?? row.m09 ?? null,
      m10: row.M10 ?? row.m10 ?? null,
      m11: row.M11 ?? row.m11 ?? null,
      m12: row.M12 ?? row.m12 ?? null
    }));

    const detailRows: DetailRow[] = (detailRawRows as any[]).map((row: any) => ({
      fr_or_cls: row.FR_OR_CLS || row.fr_or_cls || '',
      shop_id: row.SHOP_ID || row.shop_id || '',
      shop_name: row.SHOP_NAME || row.shop_name || '',
      open_ym: row.OPEN_YM || row.open_ym || null,
      city_nm: row.CITY_NM || row.city_nm || null,
      city_tier_nm: row.CITY_TIER_NM || row.city_tier_nm || null,
      shop_level_nm: row.SHOP_LEVEL_NM || row.shop_level_nm || null,
      sale_region_nm: row.SALE_REGION_NM || row.sale_region_nm || null,
      mono_multi_cd: row.MONO_MULTI_CD ?? row.mono_multi_cd ?? null,
      m01: row.M01 ?? row.m01 ?? null,
      m02: row.M02 ?? row.m02 ?? null,
      m03: row.M03 ?? row.m03 ?? null,
      m04: row.M04 ?? row.m04 ?? null,
      m05: row.M05 ?? row.m05 ?? null,
      m06: row.M06 ?? row.m06 ?? null,
      m07: row.M07 ?? row.m07 ?? null,
      m08: row.M08 ?? row.m08 ?? null,
      m09: row.M09 ?? row.m09 ?? null,
      m10: row.M10 ?? row.m10 ?? null,
      m11: row.M11 ?? row.m11 ?? null,
      m12: row.M12 ?? row.m12 ?? null
    }));

    res.status(200).json({ summaryRows, detailRows });
  } catch (e) {
    console.error("Error fetching sales report:", e);
    const errorMessage = e instanceof Error ? e.message : String(e);
    res.status(500).json({ 
      error: errorMessage,
      details: e instanceof Error ? e.stack : undefined
    });
  }
}
