import { runQuery } from "../../lib/snowflake";

interface SalesData {
  sale_ym: string;
  shop_id: string;
  shop_nm_en: string;
  fr_or_cls: string;
  open_dt: string | null;
  oa_shop_id: string | null;
  sale_amt: number;
  city_nm: string | null;
  city_tier_nm: string | null;
  shop_level_nm: string | null;
  sale_region_nm: string | null;
  mono_multi_cd: number | null;
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
            , s.shop_id
            , m.shop_nm_en
            , m.fr_or_cls
            , m.open_dt
            , s.oa_shop_id
            , SUM(s.sale_amt) AS sale_amt
            , m.city_nm
            , m.city_tier_nm
            , m.shop_level_nm
            , m.sale_region_nm
            , m.mono_multi_cd
        FROM chn.dw_sale s
        JOIN FNF.CHN.MST_SHOP_ALL m
          ON s.shop_id = m.shop_id
        WHERE 1 = 1
          AND s.brd_cd = '${brandCode}'
          AND TO_CHAR(s.sale_dt, 'YYYY-MM') BETWEEN '${selectedYear}-01' AND '${selectedYear}-${endMonth}'
          AND m.anlys_onoff_cls_nm = 'Offline'
          AND m.anlys_shop_type_nm IN ('FO', 'FP')
          AND m.fr_or_cls IN ('FR', 'OR')
        GROUP BY
              TO_CHAR(s.sale_dt, 'YYYY-MM')
            , s.shop_id
            , m.shop_nm_en
            , m.fr_or_cls
            , m.open_dt
            , s.oa_shop_id
            , m.city_nm
            , m.city_tier_nm
            , m.shop_level_nm
            , m.sale_region_nm
            , m.mono_multi_cd
      )
      SELECT *
      FROM base
      ORDER BY sale_ym, shop_id
    `;

    const rows = await runQuery(sql) as any[];

    // 컬럼명 정규화 (Snowflake는 대문자로 반환할 수 있음)
    const normalizedRows: SalesData[] = rows.map((row: any) => ({
      sale_ym: row.SALE_YM || row.sale_ym || '',
      shop_id: row.SHOP_ID || row.shop_id || '',
      shop_nm_en: row.SHOP_NM_EN || row.shop_nm_en || '',
      fr_or_cls: row.FR_OR_CLS || row.fr_or_cls || '',
      open_dt: row.OPEN_DT || row.open_dt || null,
      oa_shop_id: row.OA_SHOP_ID || row.oa_shop_id || null,
      sale_amt: Number(row.SALE_AMT || row.sale_amt || 0),
      city_nm: row.CITY_NM || row.city_nm || null,
      city_tier_nm: row.CITY_TIER_NM || row.city_tier_nm || null,
      shop_level_nm: row.SHOP_LEVEL_NM || row.shop_level_nm || null,
      sale_region_nm: row.SALE_REGION_NM || row.sale_region_nm || null,
      mono_multi_cd: Number(row.MONO_MULTI_CD ?? row.mono_multi_cd ?? null)
    }));

    res.status(200).json(normalizedRows);
  } catch (e) {
    console.error("Error fetching sales report:", e);
    const errorMessage = e instanceof Error ? e.message : String(e);
    console.error("Full error:", e);
    res.status(500).json({ 
      error: errorMessage,
      details: e instanceof Error ? e.stack : undefined
    });
  }
}
