import { runQuery } from "../../lib/snowflake";

// 도시별 매장 집계 데이터
interface CityData {
  city_nm: string;
  city_tier_nm: string | null;
  total_sale_amt: number;
  shop_count: number;
  shops: ShopInfo[];
}

interface ShopInfo {
  shop_id: string;
  shop_nm_en: string;
  sale_amt: number;
  city_nm: string;
  city_tier_nm: string | null;
}

// 매장별 상품 Top 5
interface ProductTop {
  prdt_cd: string;
  prdt_nm_kr: string;
  sale_amt: number;
  tag_amt: number;
  discount_rate: number; // 할인율 (1 - sale_amt/tag_amt)
}

export default async function handler(req: any, res: any) {
  const { type, shop_id, period } = req.query;
  
  // 기간 설정: 'monthly' = 당월(25.11), 'cumulative' = 누적(25.01~25.11)
  const isMonthly = period === 'monthly';
  const dateCondition = isMonthly 
    ? "TO_CHAR(s.sale_dt, 'YYYY-MM') = '2025-11'"
    : "TO_CHAR(s.sale_dt, 'YYYY-MM') BETWEEN '2025-01' AND '2025-11'";

  try {
    if (type === 'shop-products' && shop_id) {
      // 특정 매장의 상품 Top 5 조회 (TAG_AMT 포함)
      const productsSql = `
        SELECT 
          s.prdt_cd,
          COALESCE(p.prdt_nm_kr, s.prdt_cd) as prdt_nm_kr,
          SUM(s.sale_amt) as sale_amt,
          SUM(s.tag_amt) as tag_amt
        FROM chn.dw_sale s
        LEFT JOIN FNF.CHN.MST_PRDT p ON s.prdt_cd = p.prdt_cd
        WHERE s.brd_cd = 'X'
          AND s.shop_id = '${shop_id}'
          AND ${dateCondition}
        GROUP BY s.prdt_cd, p.prdt_nm_kr
        ORDER BY sale_amt DESC
        LIMIT 5
      `;

      const products = await runQuery(productsSql) as any[];
      
      const normalizedProducts: ProductTop[] = products.map((row: any) => {
        const saleAmt = Number(row.SALE_AMT || row.sale_amt || 0);
        const tagAmt = Number(row.TAG_AMT || row.tag_amt || 0);
        // 할인율 계산: 1 - (SALE_AMT / TAG_AMT)
        const discountRate = tagAmt > 0 ? (1 - saleAmt / tagAmt) * 100 : 0;
        
        return {
          prdt_cd: row.PRDT_CD || row.prdt_cd || '',
          prdt_nm_kr: row.PRDT_NM_KR || row.prdt_nm_kr || '',
          sale_amt: saleAmt,
          tag_amt: tagAmt,
          discount_rate: Math.round(discountRate * 10) / 10, // 소수점 1자리
        };
      });

      return res.status(200).json(normalizedProducts);
    }

    // 기본: 도시별 매장 집계 데이터
    const citySql = `
      WITH shop_sales AS (
        SELECT 
          s.shop_id,
          m.shop_nm_en,
          m.city_nm,
          m.city_tier_nm,
          SUM(s.sale_amt) as sale_amt
        FROM chn.dw_sale s
        JOIN FNF.CHN.MST_SHOP_ALL m ON s.shop_id = m.shop_id
        WHERE s.brd_cd = 'X'
          AND ${dateCondition}
          AND m.anlys_onoff_cls_nm = 'Offline'
          AND m.anlys_shop_type_nm IN ('FO', 'FP')
          AND m.fr_or_cls IN ('FR', 'OR')
        GROUP BY s.shop_id, m.shop_nm_en, m.city_nm, m.city_tier_nm
      )
      SELECT 
        shop_id,
        shop_nm_en,
        city_nm,
        city_tier_nm,
        sale_amt
      FROM shop_sales
      ORDER BY city_nm, sale_amt DESC
    `;

    const rows = await runQuery(citySql) as any[];

    // 도시별로 그룹핑
    const cityMap = new Map<string, CityData>();

    rows.forEach((row: any) => {
      const cityNm = row.CITY_NM || row.city_nm || '기타';
      const cityTierNm = row.CITY_TIER_NM || row.city_tier_nm || null;
      const shopId = row.SHOP_ID || row.shop_id || '';
      const shopNmEn = row.SHOP_NM_EN || row.shop_nm_en || '';
      const saleAmt = Number(row.SALE_AMT || row.sale_amt || 0);

      if (!cityMap.has(cityNm)) {
        cityMap.set(cityNm, {
          city_nm: cityNm,
          city_tier_nm: cityTierNm,
          total_sale_amt: 0,
          shop_count: 0,
          shops: [],
        });
      }

      const city = cityMap.get(cityNm)!;
      city.total_sale_amt += saleAmt;
      city.shop_count += 1;
      city.shops.push({
        shop_id: shopId,
        shop_nm_en: shopNmEn,
        sale_amt: saleAmt,
        city_nm: cityNm,
        city_tier_nm: cityTierNm,
      });
    });

    const result = Array.from(cityMap.values());
    res.status(200).json(result);

  } catch (e) {
    console.error("Error fetching map data:", e);
    const errorMessage = e instanceof Error ? e.message : String(e);
    res.status(500).json({ 
      error: errorMessage,
      details: e instanceof Error ? e.stack : undefined
    });
  }
}
