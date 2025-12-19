import { runQuery } from "../../lib/snowflake";

interface DealerSalesData {
  account_id: string;
  account_nm_en: string;
  hq_sap_id: string;
  sale_ym: string;
  shipment_amt: number;
  sales_amt: number;
}

export default async function handler(req, res) {
  try {
    const { brand = 'X', year = '2025' } = req.query;
    const brandCode = ['X', 'M', 'I'].includes(brand) ? brand : 'X';
    const selectedYear = ['2023', '2024', '2025'].includes(year) ? year : '2025';

    // 1. 출고매출 쿼리
    const shipmentSql = `
      SELECT
          TO_CHAR(d.pst_dt, 'YYYY-MM') AS sale_ym,
          a.account_id,
          a.account_nm_en,
          a.hq_sap_id,
          ROUND(SUM(d.tag_sale_amt), 2) AS shipment_amt
      FROM sap_fnf.dw_cn_copa_d d
      LEFT JOIN chn.mst_account a
        ON TRIM(a.hq_sap_id) = LPAD(TO_VARCHAR(d.sap_shop_cd), 10, '0')
        AND TRIM(a.hq_sap_id) <> '*'
      WHERE d.chnl_cd = '84'
        AND d.brd_cd = '${brandCode}'
        AND TO_CHAR(d.pst_dt, 'YYYY') = '${selectedYear}'
        AND a.account_id IS NOT NULL
      GROUP BY TO_CHAR(d.pst_dt, 'YYYY-MM'), a.account_id, a.account_nm_en, a.hq_sap_id
      ORDER BY a.account_id, sale_ym
    `;

    // 2. 판매매출 쿼리
    const salesSql = `
      WITH shop_map AS (
          SELECT
              shop_id,
              account_id,
              fr_or_cls
          FROM chn.dw_shop_wh_detail
          QUALIFY ROW_NUMBER() OVER (
              PARTITION BY shop_id
              ORDER BY open_dt DESC NULLS LAST
          ) = 1
      )
      SELECT
          TO_CHAR(s.sale_dt, 'YYYY-MM') AS sale_ym,
          m.account_id,
          a.account_nm_en,
          a.hq_sap_id,
          ROUND(SUM(s.tag_amt), 2) AS sales_amt
      FROM CHN.dw_sale s
      LEFT JOIN shop_map m ON s.shop_id = m.shop_id
      LEFT JOIN CHN.mst_account a ON m.account_id = a.account_id
      WHERE m.fr_or_cls = 'FR'
        AND s.brd_cd = '${brandCode}'
        AND TO_CHAR(s.sale_dt, 'YYYY') = '${selectedYear}'
        AND m.account_id IS NOT NULL
      GROUP BY TO_CHAR(s.sale_dt, 'YYYY-MM'), m.account_id, a.account_nm_en, a.hq_sap_id
      ORDER BY m.account_id, sale_ym
    `;

    // 쿼리 실행
    const [shipmentRows, salesRows] = await Promise.all([
      runQuery(shipmentSql) as Promise<any[]>,
      runQuery(salesSql) as Promise<any[]>
    ]);

    // 데이터 정규화 및 병합
    const dealerMap = new Map<string, {
      account_id: string;
      account_nm_en: string;
      hq_sap_id: string;
      shipment_months: Record<string, number>;
      sales_months: Record<string, number>;
    }>();

    // 출고매출 데이터 처리
    shipmentRows.forEach((row: any) => {
      const accountId = row.ACCOUNT_ID || row.account_id;
      const accountName = row.ACCOUNT_NM_EN || row.account_nm_en;
      const hqSapId = row.HQ_SAP_ID || row.hq_sap_id;
      const saleYm = row.SALE_YM || row.sale_ym;
      const amount = Number(row.SHIPMENT_AMT || row.shipment_amt || 0);

      if (!accountId) return;

      if (!dealerMap.has(accountId)) {
        dealerMap.set(accountId, {
          account_id: accountId,
          account_nm_en: accountName || accountId,
          hq_sap_id: hqSapId || '',
          shipment_months: {},
          sales_months: {}
        });
      }

      const dealer = dealerMap.get(accountId)!;
      const month = saleYm.split('-')[1]; // 'YYYY-MM' -> 'MM'
      dealer.shipment_months[month] = amount;
    });

    // 판매매출 데이터 처리
    salesRows.forEach((row: any) => {
      const accountId = row.ACCOUNT_ID || row.account_id;
      const accountName = row.ACCOUNT_NM_EN || row.account_nm_en;
      const hqSapId = row.HQ_SAP_ID || row.hq_sap_id;
      const saleYm = row.SALE_YM || row.sale_ym;
      const amount = Number(row.SALES_AMT || row.sales_amt || 0);

      if (!accountId) return;

      if (!dealerMap.has(accountId)) {
        dealerMap.set(accountId, {
          account_id: accountId,
          account_nm_en: accountName || accountId,
          hq_sap_id: hqSapId || '',
          shipment_months: {},
          sales_months: {}
        });
      }

      const dealer = dealerMap.get(accountId)!;
      const month = saleYm.split('-')[1]; // 'YYYY-MM' -> 'MM'
      dealer.sales_months[month] = amount;
    });

    // 결과 배열로 변환 (account_id 순 정렬)
    const dealers = Array.from(dealerMap.values()).sort((a, b) => 
      a.account_id.localeCompare(b.account_id)
    );

    res.status(200).json({ dealers });
  } catch (e) {
    console.error("Error fetching dealer sales:", e);
    const errorMessage = e instanceof Error ? e.message : String(e);
    res.status(500).json({ 
      error: errorMessage,
      details: e instanceof Error ? e.stack : undefined
    });
  }
}

