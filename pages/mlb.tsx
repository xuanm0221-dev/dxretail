import { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import BrandTabs from '../components/BrandTabs';
import YearSelector from '../components/YearSelector';

// ECharts는 SSR에서 문제가 있으므로 dynamic import
const ChinaMapChart = dynamic(() => import('../components/ChinaMapChart'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-96 bg-white rounded-xl">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-gray-200 border-t-blue-500 mb-3"></div>
        <p className="text-gray-500">지도 로딩 중...</p>
      </div>
    </div>
  ),
});

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
}

interface ShopRow {
  shop_id: string;
  shop_nm_en: string;
  shop_nm_ko: string;
  channel: string;
  open_month: string | null;
  open_dt: string | null;
  months: Record<string, number | null>;
  city_nm: string | null;
  city_tier_nm: string | null;
  shop_level_nm: string | null;
  sale_region_nm: string | null;
}

interface SummaryRow {
  type: 'summary';
  rowType: 'fr_avg' | 'fr_count' | 'or_avg' | 'or_count';
  label: string;
  channel: string;
  months: Record<string, number | null>;
}

interface DetailRow extends ShopRow {
  type?: 'detail';
  rowType?: 'detail';
}

type TableRow = DetailRow | SummaryRow;

export default function MLBDashboard() {
  const [rawData, setRawData] = useState<SalesData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(true);
  const [selectedYear, setSelectedYear] = useState('2025');

  // 한국어 매장명 매핑
  const shopNameKoMap: Record<string, string> = {
    'CN6385': '(창춘) 오야 마이창',
    'CN6382': '(하얼빈) 시청레드스퀘어',
    'CN6384': '(창춘) 오야 상두',
    'CN6383': '(타이위안) 완샹청',
    'CN6409': '(충칭) 베이청 티엔지에',
    'CN6410': '(난창) 완샹청',
    'CN6414': '(우한) 우샹 드림 몰',
    'CN6423': '(정저우) 정동 완샹청',
    'CN6424': '(베이징) IKEA',
    'CN6433': '(항저우) 룽후',
    'CN6428': '(옌지) 백화점',
    'CN6426': '(우루무치) MM1',
    'CN6435': '(자무쓰) 신마트',
    'CN6434': '(싼야) 국제 면세점 2단계',
    'CN6446': '(선양) 중싱 빌딩',
    'CN6452': '(항저우) 빌딩 쇼핑 시티',
    'CN6445': '(바이청) 유라시아 쇼핑센터',
    'CN6475': '(광저우) IGC',
    'CN1105': '(상하이) 완샹청',
    'CN1106': '(상하이) 환치우강',
    'CN1117': '(상하이) Century Link',
  };

  useEffect(() => {
    fetchData();
  }, [selectedYear]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/sales-report?brand=M&year=${selectedYear}`);
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || '데이터를 불러오는데 실패했습니다.');
      }
      
      setRawData(result);
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
      console.error('Fetch error:', err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const formatOpenMonth = (openDt: string | null): string | null => {
    if (!openDt) return null;
    try {
      const date = new Date(openDt);
      const year = date.getFullYear().toString().slice(-2);
      const month = String(date.getMonth() + 1).padStart(2, '0');
      return `${year}.${month}`;
    } catch {
      return null;
    }
  };

  const getSortKey = (openDt: string | null): string => {
    if (!openDt) return '9999-99';
    return openDt;
  };

  // 매장별로 pivot 변환
  const shopRows = useMemo(() => {
    const shopMap = new Map<string, ShopRow>();
    // 연도와 브랜드에 따른 월 배열 생성
    const yearPrefix = selectedYear.slice(-2);
    const monthCount = (selectedYear === '2025') ? 11 : 12; // 2025년 MLB는 11월까지
    const months = Array.from({ length: monthCount }, (_, i) => 
      `${yearPrefix}.${String(i + 1).padStart(2, '0')}`
    );

    rawData.forEach(item => {
      const key = item.shop_id;
      
      if (!shopMap.has(key)) {
        const mappingKey = item.oa_shop_id 
          ? item.oa_shop_id.trim().toUpperCase()
          : item.shop_id.trim().toUpperCase();
        
        const koreanName = shopNameKoMap[mappingKey] || item.shop_nm_en;
        
        shopMap.set(key, {
          shop_id: item.shop_id,
          shop_nm_en: item.shop_nm_en,
          shop_nm_ko: koreanName,
          channel: item.fr_or_cls,
          open_month: formatOpenMonth(item.open_dt),
          open_dt: item.open_dt,
          months: Object.fromEntries(months.map(m => [m, null])),
          city_nm: item.city_nm,
          city_tier_nm: item.city_tier_nm,
          shop_level_nm: item.shop_level_nm,
          sale_region_nm: item.sale_region_nm
        });
      }

      const shop = shopMap.get(key)!;
      const [year, month] = item.sale_ym.split('-');
      const monthKey = `${year.slice(-2)}.${month}`;
      
      if (shop.months.hasOwnProperty(monthKey)) {
        shop.months[monthKey] = (shop.months[monthKey] || 0) + item.sale_amt;
      }
    });

    return Array.from(shopMap.values());
  }, [rawData, selectedYear]);

  // 요약 행 계산
  const summaryRows = useMemo(() => {
    const yearPrefix = selectedYear.slice(-2);
    const monthCount = (selectedYear === '2025') ? 11 : 12;
    const months = Array.from({ length: monthCount }, (_, i) => 
      `${yearPrefix}.${String(i + 1).padStart(2, '0')}`
    );
    
    const dealerRows = shopRows.filter(s => s.channel === 'FR');
    const directRows = shopRows.filter(s => s.channel === 'OR');

    const calculateSummary = (rows: ShopRow[], label: string, channel: string, rowType: 'fr_avg' | 'fr_count' | 'or_avg' | 'or_count'): SummaryRow => {
      const monthsData: Record<string, number | null> = {};
      
      months.forEach(month => {
        const monthData = rows
          .map(row => row.months[month])
          .filter((val): val is number => val !== null && val > 0);
        
        const total = monthData.reduce((sum, val) => sum + val, 0);
        const count = monthData.length;
        
        if (label.includes('점당매출')) {
          monthsData[month] = count > 0 ? total / count : 0;
        } else if (label.includes('매장수')) {
          monthsData[month] = count;
        }
      });

      return {
        type: 'summary',
        rowType,
        label,
        channel,
        months: monthsData
      };
    };

    return [
      calculateSummary(dealerRows, '대리상 점당매출', 'FR', 'fr_avg'),
      calculateSummary(dealerRows, '대리상 매장수', 'FR', 'fr_count'),
      calculateSummary(directRows, '직영 점당매출', 'OR', 'or_avg'),
      calculateSummary(directRows, '직영 매장수', 'OR', 'or_count')
    ];
  }, [shopRows, selectedYear]);

  // 최종 테이블 행 구성
  const allRows = useMemo(() => {
    const dealerRows = shopRows
      .filter(s => s.channel === 'FR')
      .sort((a, b) => getSortKey(a.open_dt).localeCompare(getSortKey(b.open_dt)))
      .map(row => ({ ...row, type: 'detail' as const, rowType: 'detail' as const }));
    
    const directRows = shopRows
      .filter(s => s.channel === 'OR')
      .sort((a, b) => getSortKey(a.open_dt).localeCompare(getSortKey(b.open_dt)))
      .map(row => ({ ...row, type: 'detail' as const, rowType: 'detail' as const }));

    const rows: TableRow[] = [
      summaryRows[0],
      summaryRows[1],
      ...dealerRows,
      summaryRows[2],
      summaryRows[3],
      ...directRows
    ];

    return rows;
  }, [shopRows, summaryRows]);

  const summaryRowsOnly = useMemo(() => {
    return allRows.filter(r =>
      r.rowType === 'fr_avg' ||
      r.rowType === 'fr_count' ||
      r.rowType === 'or_avg' ||
      r.rowType === 'or_count'
    );
  }, [allRows]);

  const visibleRows = useMemo(() => {
    return collapsed ? summaryRowsOnly : allRows;
  }, [collapsed, summaryRowsOnly, allRows]);

  // 대리상(FR) 25.11 기준 TOP3
  const top3FrShopIds = useMemo(() => {
    const frShops = shopRows
      .filter(s => s.channel === 'FR')
      .map(shop => ({
        shop_id: shop.shop_id,
        sale: shop.months['25.11'] || 0,
      }))
      .filter(s => s.sale > 0)
      .sort((a, b) => b.sale - a.sale)
      .slice(0, 3)
      .map(s => s.shop_id);
    return new Set(frShops);
  }, [shopRows]);

  const formatNumber = (num: number | null | undefined): string => {
    if (num === null || num === undefined) return '-';
    if (num === 0) return '0';
    return new Intl.NumberFormat('ko-KR').format(Math.round(num));
  };

  const formatCount = (num: number | null | undefined): string => {
    if (num === null || num === undefined) return '-';
    if (num === 0) return '0개';
    return `${new Intl.NumberFormat('ko-KR').format(Math.round(num))}개`;
  };

  const isSummaryRow = (row: TableRow): boolean => {
    return row.type === 'summary';
  };

  const getRowKey = (row: TableRow, index: number): string => {
    if (row.type === 'summary') {
      return `summary-${row.label}`;
    }
    return `shop-${row.shop_id}`;
  };

  // 테이블 헤더용 월 배열
  const months = useMemo(() => {
    const yearPrefix = selectedYear.slice(-2);
    const monthCount = (selectedYear === '2025') ? 11 : 12;
    return Array.from({ length: monthCount }, (_, i) => 
      `${yearPrefix}.${String(i + 1).padStart(2, '0')}`
    );
  }, [selectedYear]);

  // 중국어 지역명 → 한국어 매핑
  const regionNameKoMap: Record<string, string> = {
    '东北': '동북',
    '华东': '동부',
    '华北': '화북',
    '华南': '화남',
    '华中': '중부',
    '西南': '서남',
    '西北': '서북',
    '港澳台': '홍콩/마카오/대만',
  };

  const toKoreanRegion = (region: string | null): string => {
    if (!region) return '기타';
    if (regionNameKoMap[region]) return regionNameKoMap[region];
    if (region.includes('/')) {
      return region.split('/').map(r => regionNameKoMap[r.trim()] || r.trim()).join('/');
    }
    return region;
  };

  const toK = (num: number): string => {
    return `${Math.round(num / 1000)}K`;
  };

  // AI 분석 요약 데이터
  const analysisCards = useMemo(() => {
    if (summaryRows.length === 0 || shopRows.length === 0) {
      return [
        { id: "trend", label: "월별 추세", description: "데이터 로딩 중...", color: "blue" },
        { id: "region", label: "지역별 성과", description: "데이터 로딩 중...", color: "mint" },
        { id: "newShop", label: "신규점 현황", description: "데이터 로딩 중...", color: "yellow" },
      ];
    }

    const frAvgRow = summaryRows.find(r => r.rowType === 'fr_avg');
    const orAvgRow = summaryRows.find(r => r.rowType === 'or_avg');
    const frCountRow = summaryRows.find(r => r.rowType === 'fr_count');
    const orCountRow = summaryRows.find(r => r.rowType === 'or_count');
    const dataMonths = months;
    const lastMonth = dataMonths[dataMonths.length - 1];

    // 월별 추세 분석
    const overallAvgs: number[] = [];
    const overallCounts: number[] = [];
    
    dataMonths.forEach(month => {
      const frAvg = frAvgRow?.months[month] || 0;
      const orAvg = orAvgRow?.months[month] || 0;
      const frCount = frCountRow?.months[month] || 0;
      const orCount = orCountRow?.months[month] || 0;
      
      const totalAvg = ((frAvg * frCount) + (orAvg * orCount)) / (frCount + orCount || 1);
      overallAvgs.push(totalAvg);
      overallCounts.push((frCount || 0) + (orCount || 0));
    });

    const firstMonthAvg = overallAvgs[0];
    const lastMonthAvg = overallAvgs[overallAvgs.length - 1];
    const firstCount = overallCounts[0];
    const lastCount = overallCounts[overallCounts.length - 1];
    const lastMonthLabel = dataMonths[dataMonths.length - 1];
    
    let trendDesc = "";
    if (firstMonthAvg > 0 && lastMonthAvg > 0) {
      const change = ((lastMonthAvg - firstMonthAvg) / firstMonthAvg) * 100;
      const changeStr = Math.abs(change).toFixed(1);
      
      if (change > 5) {
        trendDesc = `${dataMonths[0]} 대비 ${lastMonthLabel} 평균 점당매출 ${changeStr}% 증가(${toK(firstMonthAvg)}→${toK(lastMonthAvg)}). 매장수 ${firstCount}개→${lastCount}개로 증가하며 지속 성장 중.`;
      } else if (change < -5) {
        trendDesc = `${dataMonths[0]} 대비 ${lastMonthLabel} 평균 점당매출 ${changeStr}% 하락(${toK(firstMonthAvg)}→${toK(lastMonthAvg)}). 매장수 증가(${firstCount}개→${lastCount}개)로 점당 매출은 분산되나 총 매출은 성장 추세.`;
      } else {
        trendDesc = `${dataMonths[0]} 대비 ${lastMonthLabel} 평균 점당매출은 안정적(${toK(firstMonthAvg)}→${toK(lastMonthAvg)}). 매장수 ${firstCount}개→${lastCount}개로 증가하며 안정적 운영 중.`;
      }
    }

    // 도시/지역 분석
    const tierGroups: Record<string, { total: number; count: number }> = {};
    shopRows.forEach(shop => {
      const tier = shop.city_tier_nm || '기타';
      const sale = shop.months[lastMonth] || 0;
      if (sale > 0) {
        if (!tierGroups[tier]) tierGroups[tier] = { total: 0, count: 0 };
        tierGroups[tier].total += sale;
        tierGroups[tier].count += 1;
      }
    });
    
    const tierStats = Object.entries(tierGroups)
      .map(([tier, data]) => ({
        tier,
        avg: data.count > 0 ? data.total / data.count : 0,
        count: data.count
      }))
      .sort((a, b) => b.avg - a.avg);

    const regionGroups: Record<string, { total: number; count: number }> = {};
    shopRows.forEach(shop => {
      const region = toKoreanRegion(shop.sale_region_nm);
      const sale = shop.months[lastMonth] || 0;
      if (sale > 0) {
        if (!regionGroups[region]) regionGroups[region] = { total: 0, count: 0 };
        regionGroups[region].total += sale;
        regionGroups[region].count += 1;
      }
    });
    
    const regionStats = Object.entries(regionGroups)
      .map(([region, data]) => ({
        region,
        total: data.total,
        avg: data.count > 0 ? data.total / data.count : 0,
        count: data.count
      }))
      .sort((a, b) => b.total - a.total);

    let cityRegionDesc = "";
    if (tierStats.length >= 2) {
      const top = tierStats[0];
      const second = tierStats[1];
      const diff = top.avg > 0 && second.avg > 0 
        ? Math.round(((top.avg - second.avg) / second.avg) * 100) 
        : 0;
      cityRegionDesc = `[도시티어] ${top.tier} ${toK(top.avg)}(${top.count}개) > ${second.tier} ${toK(second.avg)} (${diff}%↑). `;
    } else if (tierStats.length === 1) {
      cityRegionDesc = `[도시티어] ${tierStats[0].tier} ${tierStats[0].count}개점, ${toK(tierStats[0].avg)}. `;
    }
    if (regionStats.length >= 2) {
      const totalSales = regionStats.reduce((sum, r) => sum + r.total, 0);
      const topRegions = regionStats.slice(0, 3);
      const topShare = totalSales > 0 
        ? Math.round((topRegions.reduce((sum, r) => sum + r.total, 0) / totalSales) * 100) 
        : 0;
      const regionList = topRegions.map(r => `${r.region}(${r.count}개)`).join(', ');
      cityRegionDesc += `[지역] ${regionList} 상위 3개 지역이 전체 ${topShare}% 차지.`;
    }
    if (!cityRegionDesc) {
      cityRegionDesc = "도시/지역 데이터 분석 중...";
    }

    // 매장 타입별 분석
    const typeGroups: Record<string, { total: number; count: number }> = {};
    shopRows.forEach(shop => {
      const type = shop.shop_level_nm || '일반';
      const sale = shop.months[lastMonth] || 0;
      if (sale > 0) {
        if (!typeGroups[type]) typeGroups[type] = { total: 0, count: 0 };
        typeGroups[type].total += sale;
        typeGroups[type].count += 1;
      }
    });
    
    const typeStats = Object.entries(typeGroups)
      .map(([type, data]) => ({
        type,
        avg: data.count > 0 ? data.total / data.count : 0,
        count: data.count
      }))
      .sort((a, b) => b.avg - a.avg);

    const shopPerformance = shopRows
      .map(shop => ({
        name: shop.shop_nm_ko,
        channel: shop.channel,
        lastMonth: shop.months[lastMonth] || 0,
      }))
      .filter(s => s.lastMonth > 0)
      .sort((a, b) => b.lastMonth - a.lastMonth);

    const topPerformers = shopPerformance.slice(0, 3);

    const newShops = shopRows
      .filter(shop => shop.open_month && shop.open_month >= '25.08')
      .map(shop => ({
        name: shop.shop_nm_ko,
        openMonth: shop.open_month,
        lastMonth: shop.months[lastMonth] || 0,
      }))
      .sort((a, b) => b.lastMonth - a.lastMonth);

    let regionDesc = "";
    if (tierStats.length >= 2) {
      const top = tierStats[0];
      const second = tierStats[1];
      const diff = top.avg > 0 && second.avg > 0 
        ? Math.round(((top.avg - second.avg) / second.avg) * 100) 
        : 0;
      regionDesc = `${top.tier}(${toK(top.avg)}, ${top.count}개) 최고 실적. ${second.tier} 대비 ${diff}%↑ 안정적 성과. `;
    }
    if (regionStats.length >= 2) {
      const topRegion = regionStats[0];
      const totalSales = regionStats.reduce((sum, r) => sum + r.total, 0);
      const topShare = totalSales > 0 ? Math.round((topRegion.total / totalSales) * 100) : 0;
      const regionList = regionStats.slice(0, 3).map(r => r.region).join(', ');
      regionDesc += `${regionList}는 본토 그룹으로 ${regionStats.slice(0, 3).reduce((sum, r) => sum + r.count, 0)}개점 운영, ${lastMonth} 평균 ${toK(regionStats.slice(0, 3).reduce((sum, r) => sum + r.avg, 0) / 3)}.`;
    }
    if (topPerformers.length > 0) {
      const topNames = topPerformers.slice(0, 2).map(s => `${s.name}(${toK(s.lastMonth)})`).join(', ');
      regionDesc = `${topNames} 최고 실적. ` + regionDesc;
    }
    if (!regionDesc) {
      regionDesc = "지역별 성과 데이터 분석 중...";
    }

    let newShopDesc = "";
    if (newShops.length > 0) {
      const openMonths = Array.from(new Set(newShops.map(s => s.openMonth))).sort();
      const monthRange = openMonths.length > 1 ? `${openMonths[0]}~${openMonths[openMonths.length - 1]}` : openMonths[0];
      const strongNewShops = newShops.filter(s => s.lastMonth > 200000);
      const weakNewShops = newShops.filter(s => s.lastMonth > 0 && s.lastMonth < 50000);
      
      newShopDesc = `${monthRange} ${newShops.length}개 신규점 집중 오픈. `;
      
      if (strongNewShops.length > 0) {
        const strongNames = strongNewShops.slice(0, 2).map(s => `${s.name}(${toK(s.lastMonth)})`).join(', ');
        newShopDesc += `${strongNames} 강세, `;
      }
      if (weakNewShops.length > 0) {
        const weakNames = weakNewShops.slice(0, 1).map(s => `${s.name}(${toK(s.lastMonth)})`).join(', ');
        newShopDesc += `반면 ${weakNames}는 초기 육성 필요. `;
      }
      newShopDesc += "신규점 런칭 관리 중요.";
    } else {
      newShopDesc = "최근 신규점 없음. 기존 매장 안정적 운영 중.";
    }
    if (typeStats.length >= 2) {
      const typeList = typeStats.slice(0, 2).map(t => `${t.type}(${toK(t.avg)}, ${t.count}개)`).join(', ');
      newShopDesc = `[타입] ${typeList}. ` + newShopDesc;
    }

    return [
      {
        id: "trend",
        label: "월별 추세",
        description: trendDesc || "월별 추세 분석 중...",
        color: "blue",
      },
      {
        id: "region",
        label: "지역별 성과",
        description: regionDesc,
        color: "mint",
      },
      {
        id: "newShop",
        label: "신규점 현황",
        description: newShopDesc,
        color: "yellow",
      },
    ];
  }, [summaryRows, shopRows, months]);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-full mx-auto">
        {/* 헤더 고정 영역 */}
        <div className="sticky top-0 z-50 bg-gray-100 rounded-xl mb-6 px-6 py-5">
          <div className="flex items-center justify-between mb-4">
            <div className="text-center flex-1">
              <h1 className="text-5xl font-bold text-blue-600 tracking-wide">
                MLB 매장별 리테일 매출
              </h1>
            </div>
          </div>
          <div className="flex justify-center">
            <BrandTabs currentBrand="mlb" />
          </div>
        </div>

        {/* AI 분석 요약 섹션 */}
        {!loading && !error && (
          <section className="mb-4">
            <div className="grid gap-4 grid-cols-1 lg:grid-cols-4">
              {/* 왼쪽 3개 분석 박스 */}
              <div className="lg:col-span-3 grid gap-4 md:grid-cols-3">
                {analysisCards.map((card) => {
                  const colorStyles: Record<string, { bg: string; border: string; icon: string; iconBg: string; title: string }> = {
                    blue: {
                      bg: 'bg-blue-50',
                      border: 'border-blue-200',
                      icon: '📊',
                      iconBg: 'bg-blue-100',
                      title: 'text-blue-800',
                    },
                    mint: {
                      bg: 'bg-teal-50',
                      border: 'border-teal-200',
                      icon: '🌍',
                      iconBg: 'bg-teal-100',
                      title: 'text-teal-800',
                    },
                    yellow: {
                      bg: 'bg-amber-50',
                      border: 'border-amber-200',
                      icon: '🆕',
                      iconBg: 'bg-amber-100',
                      title: 'text-amber-800',
                    },
                  };
                  const style = colorStyles[card.color] || colorStyles.blue;
                  
                  return (
                    <div
                      key={card.id}
                      className={`relative overflow-hidden rounded-xl border ${style.border} ${style.bg} px-4 py-4 shadow-sm`}
                    >
                      <div className="mb-3 flex items-center gap-3">
                        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${style.iconBg} text-lg`}>
                          {style.icon}
                        </span>
                        <span className={`text-sm font-bold ${style.title}`}>
                          {card.label}
                        </span>
                      </div>
                      <p className="text-sm leading-relaxed text-gray-700">{card.description}</p>
                    </div>
                  );
                })}
              </div>

              {/* 우측 점포현황 박스 */}
              <div className="lg:col-span-1 bg-gradient-to-b from-sky-50 to-white rounded-xl border border-sky-100 shadow-sm overflow-hidden">
                <div className="p-3">
                  <div className="grid grid-cols-2 gap-2">
                    {/* 대리상 점당매출 */}
                    <div className="bg-white rounded-lg border border-gray-200 p-2">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-semibold text-sky-600">대리상 점당매출</span>
                        <span className="text-sm font-bold text-gray-800">
                          {formatNumber(summaryRows.find(r => r.rowType === 'fr_avg')?.months['25.11'] || 0)}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mb-1">🏆 TOP 3 매장</div>
                      <div className="space-y-1">
                        {shopRows
                          .filter(s => s.channel === 'FR')
                          .map(s => ({ name: s.shop_nm_ko, sale: s.months['25.11'] || 0 }))
                          .filter(s => s.sale > 0)
                          .sort((a, b) => b.sale - a.sale)
                          .slice(0, 3)
                          .map((shop, idx) => (
                            <div key={idx} className={`flex justify-between items-center px-1 py-0.5 rounded ${idx === 0 ? 'bg-yellow-100' : idx === 1 ? 'bg-gray-100' : 'bg-amber-50'}`}>
                              <span className="text-[10px] font-medium text-gray-700 truncate">{idx + 1}위 {shop.name}</span>
                              <span className="text-[10px] font-bold text-gray-800 ml-1">{formatNumber(shop.sale)}</span>
                            </div>
                          ))
                        }
                      </div>
                    </div>

                    {/* 직영 점당매출 */}
                    <div className="bg-white rounded-lg border border-gray-200 p-2">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-semibold text-blue-600">직영 점당매출</span>
                        <span className="text-sm font-bold text-gray-800">
                          {formatNumber(summaryRows.find(r => r.rowType === 'or_avg')?.months['25.11'] || 0)}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mb-1">⭐ 최고 매장</div>
                      <div className="space-y-1">
                        {shopRows
                          .filter(s => s.channel === 'OR')
                          .map(s => ({ name: s.shop_nm_ko, sale: s.months['25.11'] || 0 }))
                          .filter(s => s.sale > 0)
                          .sort((a, b) => b.sale - a.sale)
                          .slice(0, 1)
                          .map((shop, idx) => (
                            <div key={idx} className="flex justify-between items-center px-1 py-0.5 rounded bg-blue-100">
                              <span className="text-[10px] font-medium text-gray-700 truncate">{shop.name}</span>
                              <span className="text-[10px] font-bold text-gray-800 ml-1">{formatNumber(shop.sale)}</span>
                            </div>
                          ))
                        }
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* 연도 선택 */}
        {!loading && !error && (
          <YearSelector 
            selectedYear={selectedYear} 
            onYearChange={setSelectedYear} 
          />
        )}

        {/* 로딩 상태 */}
        {loading && (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-[#5B8DEF] mb-4"></div>
            <p className="text-gray-600 text-lg">데이터를 불러오는 중...</p>
          </div>
        )}

        {/* 에러 상태 */}
        {error && (
          <div className="bg-red-50/80 backdrop-blur-sm border-2 border-red-200 rounded-2xl p-6 mb-6 shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <span className="text-red-600 text-xl">⚠️</span>
              </div>
              <div>
                <p className="text-red-800 font-semibold">오류가 발생했습니다</p>
                <p className="text-red-600 text-sm mt-1">{error}</p>
              </div>
            </div>
            <button
              onClick={fetchData}
              className="px-5 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors duration-200 shadow-md hover:shadow-lg"
            >
              다시 시도
            </button>
          </div>
        )}

        {/* 빈 데이터 상태 */}
        {!loading && !error && visibleRows.length === 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <div className="text-6xl mb-4">📊</div>
            <p className="text-gray-600 text-lg">데이터가 없습니다.</p>
          </div>
        )}

        {/* 메인 테이블 */}
        {!loading && !error && visibleRows.length > 0 && (
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden w-full">
            <div className="w-full overflow-x-auto overflow-y-auto max-h-[calc(100vh-300px)]">
              <table className="border-collapse w-full" style={{ tableLayout: 'fixed', minWidth: '1620px' }}>
                <colgroup>
                  <col style={{ width: '260px', minWidth: '260px' }} />
                  <col style={{ width: '70px', minWidth: '70px' }} />
                  <col style={{ width: '80px', minWidth: '80px' }} />
                  {months.map((month) => (
                    <col key={month} style={{ width: '110px', minWidth: '110px' }} />
                  ))}
                </colgroup>
                <thead className="sticky top-0 z-50">
                  <tr className="bg-[#1E3A5F]">
                    <th className="sticky left-0 z-50 bg-[#1E3A5F] border-r border-blue-800 px-3 py-3 text-left font-bold text-white shadow-lg">
                      <div className="flex items-center gap-2">
                        <span className="truncate">매장명</span>
                        <button
                          type="button"
                          onClick={() => setCollapsed(prev => !prev)}
                          className="rounded-full border border-white/30 px-2 py-0.5 text-xs text-white hover:bg-white/20 transition-colors flex-shrink-0"
                        >
                          {collapsed ? '펼치기' : '접기'}
                        </button>
                      </div>
                    </th>
                    <th className="sticky left-[260px] z-50 bg-[#1E3A5F] border-r border-blue-800 px-2 py-3 text-center font-bold text-white shadow-lg">
                      채널
                    </th>
                    <th className="sticky left-[330px] z-50 bg-[#1E3A5F] border-r border-blue-800 px-2 py-3 text-center font-bold text-white shadow-lg">
                      오픈월
                    </th>
                    {months.map((month, monthIdx) => (
                      <th
                        key={month}
                        className="px-2 py-3 text-center font-bold text-white border-l border-blue-800 bg-[#1E3A5F]"
                      >
                        {monthIdx + 1}월
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row, idx) => {
                    const isSummary = isSummaryRow(row);
                    const rowKey = getRowKey(row, idx);
                    
                    const isTop3 = !isSummary && row.type === 'detail' && 
                      (row as ShopRow).channel === 'FR' && 
                      top3FrShopIds.has((row as ShopRow).shop_id);
                    
                    const getRowBg = () => {
                      if (isSummary) {
                        return 'bg-sky-100';
                      }
                      if (isTop3) {
                        return 'bg-yellow-100';
                      }
                      return 'bg-white';
                    };

                    const rowBgColor = isSummary ? '#e0f2fe' : isTop3 ? '#fef9c3' : '#ffffff';

                    return (
                      <tr 
                        key={rowKey} 
                        className={`${getRowBg()} transition-all duration-200 border-b border-gray-200 hover:bg-gray-100`}
                      >
                        {/* 매장명 */}
                        <td
                          className={`sticky left-0 z-20 border-r border-gray-300 px-3 py-2 ${
                            isSummary 
                              ? 'font-bold text-gray-800' 
                              : isTop3
                              ? 'text-gray-800 font-medium'
                              : 'text-gray-800 font-medium'
                          } shadow-sm overflow-hidden`}
                          style={{ backgroundColor: rowBgColor }}
                        >
                          {isSummary ? (
                            <span className="flex items-center gap-2">
                              <span className="text-lg">📊</span>
                              {(row as SummaryRow).label}
                            </span>
                          ) : (
                            <span className="hover:text-[#5B8DEF] transition-colors">
                              {(row as ShopRow).shop_nm_ko}
                            </span>
                          )}
                        </td>
                        
                        {/* 채널 */}
                        <td
                          className={`sticky left-[260px] z-19 border-r border-gray-300 px-2 py-2 text-center ${
                            isSummary 
                              ? 'font-bold text-gray-800' 
                              : 'text-gray-700'
                          } shadow-sm`}
                          style={{ backgroundColor: rowBgColor }}
                        >
                          <span className={`inline-block px-3 py-1 rounded-full text-xs ${
                            isSummary ? 'font-bold' : 'font-semibold'
                          } ${
                            row.channel === 'FR' 
                              ? 'bg-blue-100 text-blue-700' 
                              : 'bg-gray-200 text-gray-700'
                          }`}>
                            {row.channel}
                          </span>
                        </td>
                        
                        {/* 오픈월 */}
                        <td
                          className={`sticky left-[330px] z-18 border-r border-gray-300 px-2 py-2 text-center ${
                            isSummary 
                              ? 'font-bold text-gray-800' 
                              : 'text-gray-700'
                          } shadow-sm`}
                          style={{ backgroundColor: rowBgColor }}
                        >
                          {isSummary ? (
                            <span className="text-gray-400">-</span>
                          ) : (
                            <span className="text-gray-600 font-medium">
                              {(row as ShopRow).open_month || '-'}
                            </span>
                          )}
                        </td>
                        
                        {/* 월별 매출 데이터 (25.01 ~ 25.11) */}
                        {months.map((month, monthIdx) => {
                          return (
                            <td
                              key={month}
                              className={`border-l border-gray-200 px-2 py-2 text-right text-gray-700 ${
                                isSummary ? 'font-bold' : 'font-medium'
                              }`}
                              style={{ backgroundColor: rowBgColor }}
                            >
                              <span className="block truncate">
                                {isSummary && (row.rowType === 'fr_count' || row.rowType === 'or_count')
                                  ? formatCount((row as SummaryRow).months[month])
                                  : formatNumber(isSummary ? (row as SummaryRow).months[month] : (row as ShopRow).months[month])
                                }
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 하단 정보 및 새로고침 */}
        <div className="mt-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/60 backdrop-blur-sm rounded-xl p-4 shadow-md">
          <p className="text-sm text-gray-600 flex items-center gap-2">
            <span className="text-blue-500">💡</span>
            <span>
              {selectedYear === '2025' 
                ? 'MLB 브랜드는 2025년 1~11월 데이터만 표시됩니다.' 
                : `MLB 브랜드 ${selectedYear}년 데이터를 표시하고 있습니다. (1~12월)`
              }
            </span>
          </p>
          <button
            onClick={fetchData}
            className="px-5 py-2.5 bg-gradient-to-r from-gray-500 to-gray-600 text-white rounded-lg hover:from-gray-600 hover:to-gray-700 font-semibold shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105 flex items-center gap-2"
          >
            <span>🔄</span>
            새로고침
          </button>
        </div>

        {/* 지도 섹션 */}
        {!loading && !error && (
          <section className="mt-8">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6">
              <ChinaMapChart brand="M" year={selectedYear} />
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

