import { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import BrandTabs from '../components/BrandTabs';
import YearSelector from '../components/YearSelector';
import DealerSalesTable from '../components/DealerSalesTable';

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
  shop_nm_ko: string; // 한국어 매장명
  channel: string;
  open_month: string | null; // YY.MM 형식
  open_dt: string | null; // 원본 날짜 (정렬용)
  months: Record<string, number | null>; // 25.01 ~ 25.11
  city_nm: string | null; // 도시명
  city_tier_nm: string | null; // 도시 티어
  shop_level_nm: string | null; // 매장 타입 (Outlet, Pop-up 등)
  sale_region_nm: string | null; // 지역 구분
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

// 수기입력용 가상 행 타입
interface ManualInputRow {
  type: 'manual_input';
  rowType: 'manual_input';
  id: string;
  shop_nm_ko: string;
  channel: 'FR';
  open_month: '25.12';
}

type TableRow = DetailRow | SummaryRow | ManualInputRow;

export default function Dashboard() {
  const [rawData, setRawData] = useState<SalesData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [manualDecValues, setManualDecValues] = useState<Record<string, number | null>>({});
  const [collapsedFR, setCollapsedFR] = useState(true);
  const [collapsedOR, setCollapsedOR] = useState(true);
  const [selectedYear, setSelectedYear] = useState('2025');
  
  // 신규대리상 수기입력 값
  const [manualNewFrValues, setManualNewFrValues] = useState<Record<string, number | null>>({});

  // 신규대리상 이름
  const [manualNewFrNames, setManualNewFrNames] = useState<Record<string, string>>({});

  // localStorage 초기화 여부 추적
  const [isHydrated, setIsHydrated] = useState(false);

  // 클라이언트 마운트 후 JSON 파일에서 값 읽어오기 (우선), 없으면 localStorage
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        // 1. 먼저 JSON 파일에서 로드 시도 (Git에 커밋된 데이터)
        const response = await fetch('/data/manual-inputs.json');
        if (response.ok) {
          const jsonData = await response.json();
          
          // JSON 파일에 데이터가 있으면 사용
          if (jsonData.manualDecValues && Object.keys(jsonData.manualDecValues).length > 0) {
            setManualDecValues(jsonData.manualDecValues);
          }
          if (jsonData.manualNewFrValues && Object.keys(jsonData.manualNewFrValues).length > 0) {
            setManualNewFrValues(jsonData.manualNewFrValues);
          }
          if (jsonData.manualNewFrNames && Object.keys(jsonData.manualNewFrNames).length > 0) {
            setManualNewFrNames(jsonData.manualNewFrNames);
          }
        }
      } catch (err) {
        console.log('JSON 파일 로드 실패, localStorage에서 로드 시도');
      }
      
      // 2. localStorage에서 추가 로드 (로컬 작업 중인 데이터)
      const savedDecValues = localStorage.getItem('manualDecValues');
      const savedNewFrValues = localStorage.getItem('manualNewFrValues');
      const savedNewFrNames = localStorage.getItem('manualNewFrNames');
      
      // localStorage에 더 많은 데이터가 있으면 병합
      if (savedDecValues) {
        const localData = JSON.parse(savedDecValues);
        setManualDecValues(prev => ({ ...prev, ...localData }));
      }
      if (savedNewFrValues) {
        const localData = JSON.parse(savedNewFrValues);
        setManualNewFrValues(prev => ({ ...prev, ...localData }));
      }
      if (savedNewFrNames) {
        const localData = JSON.parse(savedNewFrNames);
        setManualNewFrNames(prev => ({ ...prev, ...localData }));
      }
      
      setIsHydrated(true);
    };
    
    loadInitialData();
  }, []);

  // 한국어 매장명 매핑
  const shopNameKoMap: Record<string, string> = {
    'CN6385': '(창춘) 오야 마이창',
    'CN6382': '(하얼빈) 시청레드스퀘어',
    'CN6384': '(창춘) 오야 상두',
    'CN6383': '(타이웬) 완샹청',
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

  // 기존 매장 25.12 수기입력 값 localStorage에 저장 (hydration 완료 후에만)
  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem('manualDecValues', JSON.stringify(manualDecValues));
    }
  }, [manualDecValues, isHydrated]);

  // 신규대리상 수기입력 값 localStorage에 저장 (hydration 완료 후에만)
  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem('manualNewFrValues', JSON.stringify(manualNewFrValues));
    }
  }, [manualNewFrValues, isHydrated]);

  // 신규대리상 이름 localStorage에 저장 (hydration 완료 후에만)
  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem('manualNewFrNames', JSON.stringify(manualNewFrNames));
    }
  }, [manualNewFrNames, isHydrated]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/sales-report?brand=X&year=${selectedYear}`);
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

  // 오픈날짜를 YY.MM 형식으로 변환
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

  // 오픈날짜를 정렬용으로 변환 (YYYY-MM 형식 유지)
  const getSortKey = (openDt: string | null): string => {
    if (!openDt) return '9999-99'; // NULL은 맨 아래
    return openDt;
  };

  // 매장별로 pivot 변환
  const shopRows = useMemo(() => {
    const shopMap = new Map<string, ShopRow>();
    // 연도에 따른 월 배열 생성
    const yearPrefix = selectedYear.slice(-2);
    const months = Array.from({ length: 12 }, (_, i) => 
      `${yearPrefix}.${String(i + 1).padStart(2, '0')}`
    );

    rawData.forEach(item => {
      const key = item.shop_id;
      
      if (!shopMap.has(key)) {
        // 한국어 매장명 매핑: oa_shop_id가 있으면 우선 사용, 없으면 shop_id 사용
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
      // sale_ym을 25.01 형식으로 변환
      const [year, month] = item.sale_ym.split('-');
      const monthKey = `${year.slice(-2)}.${month}`;
      
      if (shop.months.hasOwnProperty(monthKey)) {
        shop.months[monthKey] = (shop.months[monthKey] || 0) + item.sale_amt;
      }
    });

      return Array.from(shopMap.values());
  }, [rawData, selectedYear]);

  // 신규대리상 수기입력 행 4개 생성
  const manualInputRows: ManualInputRow[] = useMemo(() => {
    return [1, 2, 3, 4].map(num => ({
      type: 'manual_input' as const,
      rowType: 'manual_input' as const,
      id: `manual_fr_${num}`,
      shop_nm_ko: manualNewFrNames[`manual_fr_${num}`] || `신규대리상(12월)_${num}`,
      channel: 'FR' as const,
      open_month: '25.12' as const,
    }));
  }, [manualNewFrNames]);

  // 요약 행 계산 (수기입력 값 포함)
  const summaryRows = useMemo(() => {
    const yearPrefix = selectedYear.slice(-2);
    const monthCount = 12; // Discovery는 항상 12개월
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
        
        let total = monthData.reduce((sum, val) => sum + val, 0);
        let count = monthData.length;
        
        // 2025년 12월일 때만 수기입력 값 추가
        if (selectedYear === '2025' && month === '25.12') {
          // 기존 매장들의 25.12 수기입력 값 추가
          rows.forEach(row => {
            const rowKey = `shop-${row.shop_id}`;
            const val = manualDecValues[rowKey];
            if (val !== null && val !== undefined && val > 0) {
              total += val;
              count += 1;
            }
          });
          
          // 대리상(FR)일 때만 신규대리상 4개 행의 값 추가
          if (channel === 'FR') {
            [1, 2, 3, 4].forEach(num => {
              const val = manualNewFrValues[`manual_fr_${num}`];
              if (val !== null && val !== undefined && val > 0) {
                total += val;
                count += 1;
              }
            });
          }
        }
        
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
  }, [shopRows, manualDecValues, manualNewFrValues, selectedYear]);

  // 최종 테이블 행 구성 (정렬 포함)
  const allRows = useMemo(() => {
    const dealerRows = shopRows
      .filter(s => s.channel === 'FR')
      .sort((a, b) => {
        const keyA = getSortKey(a.open_dt);
        const keyB = getSortKey(b.open_dt);
        return keyA.localeCompare(keyB);
      })
      .map(row => ({ ...row, type: 'detail' as const, rowType: 'detail' as const }));
    
    const directRows = shopRows
      .filter(s => s.channel === 'OR')
      .sort((a, b) => {
        const keyA = getSortKey(a.open_dt);
        const keyB = getSortKey(b.open_dt);
        return keyA.localeCompare(keyB);
      })
      .map(row => ({ ...row, type: 'detail' as const, rowType: 'detail' as const }));

    const rows: TableRow[] = [
      summaryRows[0], // 대리상 점당매출 (fr_avg)
      summaryRows[1], // 대리상 매장수 (fr_count)
      ...dealerRows,
      ...manualInputRows, // 신규대리상 수기입력 4개 행 (대리상 매장 맨 아래)
      summaryRows[2], // 직영 점당매출 (or_avg)
      summaryRows[3], // 직영 매장수 (or_count)
      ...directRows
    ];

    return rows;
  }, [shopRows, summaryRows, manualInputRows]);

  // visibleRows 결정 (FR과 OR 각각 독립적으로 펼치기/접기)
  const visibleRows = useMemo(() => {
    return allRows.filter(row => {
      // 요약 행은 항상 표시
      if (row.type === 'summary') return true;
      
      // 신규대리상 수기입력 행
      if (row.type === 'manual_input') {
        return !collapsedFR; // 대리상이 펼쳐져 있을 때만 표시
      }
      
      // 일반 매장 행
      if (row.type === 'detail') {
        if (row.channel === 'FR') {
          return !collapsedFR; // 대리상이 펼쳐져 있을 때만 표시
        }
        if (row.channel === 'OR') {
          return !collapsedOR; // 직영이 펼쳐져 있을 때만 표시
        }
      }
      
      return true;
    });
  }, [allRows, collapsedFR, collapsedOR]);

  // 대리상(FR) 25.11 기준 TOP3 shop_id 계산
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

  // 매장수용 포맷 함수 (숫자 뒤에 "개" 붙임)
  const formatCount = (num: number | null | undefined): string => {
    if (num === null || num === undefined) return '-';
    if (num === 0) return '0개';
    return `${new Intl.NumberFormat('ko-KR').format(Math.round(num))}개`;
  };

  // 콤마 제거하고 숫자만 추출
  const parseFormattedNumber = (value: string): number | null => {
    const cleaned = value.replace(/,/g, '').trim();
    if (cleaned === '') return null;
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  };

  // 숫자를 천단위 콤마 포맷으로 변환 (입력용)
  const formatInputNumber = (num: number | null | undefined): string => {
    if (num === null || num === undefined) return '';
    return new Intl.NumberFormat('ko-KR').format(num);
  };

  const handleDecValueChange = (key: string, value: string) => {
    const numValue = parseFormattedNumber(value);
    setManualDecValues(prev => ({
      ...prev,
      [key]: numValue
    }));
  };

  // 신규대리상 수기입력 값 변경 핸들러
  const handleNewFrValueChange = (key: string, value: string) => {
    const numValue = parseFormattedNumber(value);
    setManualNewFrValues(prev => ({
      ...prev,
      [key]: numValue
    }));
  };

  // 신규대리상 이름 변경 핸들러
  const handleNewFrNameChange = (key: string, value: string) => {
    setManualNewFrNames(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // JSON 파일 다운로드 함수
  const downloadJsonFile = () => {
    const dataToSave = {
      lastUpdated: new Date().toISOString(),
      manualDecValues,
      manualNewFrValues,
      manualNewFrNames
    };
    
    const jsonString = JSON.stringify(dataToSave, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = 'manual-inputs.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSave = () => {
    const dataToSave = {
      lastUpdated: new Date().toISOString(),
      manualDecValues,
      manualNewFrValues,
      manualNewFrNames
    };
    console.log('저장할 데이터:', dataToSave);
    
    const existingCount = Object.values(manualDecValues).filter(v => v !== null && v > 0).length;
    const newFrCount = Object.values(manualNewFrValues).filter(v => v !== null && v > 0).length;
    const nameCount = Object.values(manualNewFrNames).filter(v => v && v.trim() !== '').length;
    
    // JSON 파일 다운로드
    downloadJsonFile();
    
    alert(`25.12 매출 입력값이 다운로드되었습니다.\n- 기존 매장: ${existingCount}개\n- 신규대리상: ${newFrCount}개\n- 신규대리상 이름 수정: ${nameCount}개\n\n📁 다운로드된 'manual-inputs.json' 파일을\n프로젝트의 public/data/ 폴더에 덮어쓰기 후\nGit 커밋 & 푸시하세요!`);
  };

  const isSummaryRow = (row: TableRow): boolean => {
    return row.type === 'summary';
  };

  const isManualInputRow = (row: TableRow): row is ManualInputRow => {
    return row.type === 'manual_input';
  };

  const getRowKey = (row: TableRow, index: number): string => {
    if (row.type === 'summary') {
      return `summary-${row.label}`;
    }
    if (row.type === 'manual_input') {
      return row.id;
    }
    return `shop-${row.shop_id}`;
  };

  // 테이블 헤더용 월 배열
  const months = useMemo(() => {
    const yearPrefix = selectedYear.slice(-2);
    return Array.from({ length: 12 }, (_, i) => 
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

  // 지역명 한국어 변환 함수 (슬래시로 구분된 복합 값도 처리)
  const toKoreanRegion = (region: string | null): string => {
    if (!region) return '기타';
    // 직접 매핑이 있으면 반환
    if (regionNameKoMap[region]) return regionNameKoMap[region];
    // 슬래시(/)로 구분된 경우 각각 변환
    if (region.includes('/')) {
      return region.split('/').map(r => regionNameKoMap[r.trim()] || r.trim()).join('/');
    }
    return region;
  };

  // K 단위 포맷 함수 (1000으로 나눔)
  const toK = (num: number): string => {
    return `${Math.round(num / 1000)}K`;
  };

  // AI 분석 요약 데이터 (실제 데이터 기반 동적 생성)
  const analysisCards = useMemo(() => {
    if (summaryRows.length === 0 || shopRows.length === 0) {
      return [
        { id: "trend", label: "월별 추세", description: "데이터 로딩 중...", color: "purple" },
        { id: "region", label: "지역별 성과", description: "데이터 로딩 중...", color: "mint" },
        { id: "newShop", label: "신규점 현황", description: "데이터 로딩 중...", color: "yellow" },
      ];
    }

    // 공통 데이터 준비
    const frAvgRow = summaryRows.find(r => r.rowType === 'fr_avg');
    const orAvgRow = summaryRows.find(r => r.rowType === 'or_avg');
    const frCountRow = summaryRows.find(r => r.rowType === 'fr_count');
    const orCountRow = summaryRows.find(r => r.rowType === 'or_count');
    const dataMonths = months.slice(0, 11); // 25.01 ~ 25.11
    const lastMonth = dataMonths[dataMonths.length - 1];

    // ========== 1. 월별 추세 분석 ==========
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

    // ========== 2. 도시/지역 분석 (도시 티어 + 지역 구분 통합) ==========
    // 도시 티어별 분석
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

    // 지역(Region)별 분석
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
    // 도시 티어 분석
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
    // 지역 분석 추가
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

    // ========== 3. 매장 분석 (매장타입 + TOP매장 + 신규점 통합) ==========
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

    // TOP 매장 분석
    const shopPerformance = shopRows
      .map(shop => ({
        name: shop.shop_nm_ko,
        channel: shop.channel,
        lastMonth: shop.months[lastMonth] || 0,
      }))
      .filter(s => s.lastMonth > 0)
      .sort((a, b) => b.lastMonth - a.lastMonth);

    const topPerformers = shopPerformance.slice(0, 3);

    // 신규점 분석
    const newShops = shopRows
      .filter(shop => shop.open_month && shop.open_month >= '25.08')
      .map(shop => ({
        name: shop.shop_nm_ko,
        openMonth: shop.open_month,
        lastMonth: shop.months[lastMonth] || 0,
      }))
      .sort((a, b) => b.lastMonth - a.lastMonth);

    // ========== 박스2: 지역별 성과 (도시티어 + 지역구분 + TOP매장) ==========
    let regionDesc = "";
    // 도시 티어
    if (tierStats.length >= 2) {
      const top = tierStats[0];
      const second = tierStats[1];
      const diff = top.avg > 0 && second.avg > 0 
        ? Math.round(((top.avg - second.avg) / second.avg) * 100) 
        : 0;
      regionDesc = `${top.tier}(${toK(top.avg)}, ${top.count}개) 최고 실적. ${second.tier} 대비 ${diff}%↑ 안정적 성과. `;
    }
    // 지역 구분
    if (regionStats.length >= 2) {
      const topRegion = regionStats[0];
      const totalSales = regionStats.reduce((sum, r) => sum + r.total, 0);
      const topShare = totalSales > 0 ? Math.round((topRegion.total / totalSales) * 100) : 0;
      const regionList = regionStats.slice(0, 3).map(r => r.region).join(', ');
      regionDesc += `${regionList}는 본토 그룹으로 ${regionStats.slice(0, 3).reduce((sum, r) => sum + r.count, 0)}개점 운영, ${lastMonth} 평균 ${toK(regionStats.slice(0, 3).reduce((sum, r) => sum + r.avg, 0) / 3)}.`;
    }
    // TOP 매장
    if (topPerformers.length > 0) {
      const topNames = topPerformers.slice(0, 2).map(s => `${s.name}(${toK(s.lastMonth)})`).join(', ');
      regionDesc = `${topNames} 최고 실적. ` + regionDesc;
    }
    if (!regionDesc) {
      regionDesc = "지역별 성과 데이터 분석 중...";
    }

    // ========== 박스3: 신규점 현황 (매장타입 + 신규점) ==========
    let newShopDesc = "";
    // 신규점 오픈 현황
    if (newShops.length > 0) {
      const openMonths = Array.from(new Set(newShops.map(s => s.openMonth))).sort();
      const monthRange = openMonths.length > 1 ? `${openMonths[0]}~${openMonths[openMonths.length - 1]}` : openMonths[0];
      const strongNewShops = newShops.filter(s => s.lastMonth > 200000);
      const weakNewShops = newShops.filter(s => s.lastMonth > 0 && s.lastMonth < 50000);
      
      newShopDesc = `${monthRange} ${newShops.length}개 신규점 집중 오픈. `;
      
      // 강세 매장
      if (strongNewShops.length > 0) {
        const strongNames = strongNewShops.slice(0, 2).map(s => `${s.name}(${toK(s.lastMonth)})`).join(', ');
        newShopDesc += `${strongNames} 강세, `;
      }
      // 약세 매장
      if (weakNewShops.length > 0) {
        const weakNames = weakNewShops.slice(0, 1).map(s => `${s.name}(${toK(s.lastMonth)})`).join(', ');
        newShopDesc += `반면 ${weakNames}는 초기 육성 필요. `;
      }
      newShopDesc += "신규점 런칭 관리 중요.";
    } else {
      newShopDesc = "최근 신규점 없음. 기존 매장 안정적 운영 중.";
    }
    // 매장 타입 추가
    if (typeStats.length >= 2) {
      const typeList = typeStats.slice(0, 2).map(t => `${t.type}(${toK(t.avg)}, ${t.count}개)`).join(', ');
      newShopDesc = `[타입] ${typeList}. ` + newShopDesc;
    }

    return [
      {
        id: "trend",
        label: "월별 추세",
        description: trendDesc || "월별 추세 분석 중...",
        color: "purple", // 보라색
      },
      {
        id: "region",
        label: "지역별 성과",
        description: regionDesc,
        color: "mint", // 민트색
      },
      {
        id: "newShop",
        label: "신규점 현황",
        description: newShopDesc,
        color: "yellow", // 노란색
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
              <h1 className="text-5xl font-bold text-purple-600 tracking-wide">
                Discovery 매장별 리테일 매출
              </h1>
            </div>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-purple-500 text-white text-sm rounded-lg hover:bg-purple-600 font-medium transition-colors duration-200"
            >
              💾 25.12 저장
            </button>
          </div>
          <div className="flex justify-center">
            <BrandTabs currentBrand="discovery" />
          </div>
        </div>

        {/* AI 분석 요약 섹션 */}
        {!loading && !error && (
          <section className="mb-4">
            <div className="grid gap-4 grid-cols-1 lg:grid-cols-4">
              {/* 왼쪽 3개 분석 박스 */}
              <div className="lg:col-span-3 grid gap-4 md:grid-cols-3">
                {analysisCards.map((card) => {
                  // 색상별 스타일 정의
                  const colorStyles: Record<string, { bg: string; border: string; icon: string; iconBg: string; title: string }> = {
                    purple: {
                      bg: 'bg-purple-50',
                      border: 'border-purple-200',
                      icon: '📊',
                      iconBg: 'bg-purple-100',
                      title: 'text-purple-800',
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
                  const style = colorStyles[card.color] || colorStyles.purple;
                  
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
                  {/* 대리상 / 직영 좌우 배치 */}
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
          <>
            {/* 섹션 제목 + 연도 선택 */}
            <div className="mb-6 bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-8 bg-purple-500 rounded-full"></div>
                  <h2 className="text-xl font-bold text-gray-800">1. 점당매출</h2>
                </div>
                <YearSelector 
                  selectedYear={selectedYear} 
                  onYearChange={setSelectedYear} 
                />
              </div>
            </div>
            
            <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden w-full">
            <div className="w-full overflow-x-auto overflow-y-auto max-h-[calc(100vh-300px)]">
              <table className="border-collapse w-full" style={{ tableLayout: 'fixed', minWidth: '1730px' }}>
                {/* 컬럼 너비 고정 */}
                <colgroup>
                  <col style={{ width: '260px', minWidth: '260px' }} /> {/* 매장명 */}
                  <col style={{ width: '70px', minWidth: '70px' }} />  {/* 채널 */}
                  <col style={{ width: '80px', minWidth: '80px' }} />  {/* 오픈월 */}
                  {months.map((month) => (
                    <col key={month} style={{ width: '110px', minWidth: '110px' }} /> /* 1~12월 */
                  ))}
                </colgroup>
                {/* 고정 헤더 */}
            <thead className="sticky top-0 z-40">
              <tr className="bg-[#1E3A5F]">
                <th className="sticky left-0 z-45 bg-[#1E3A5F] border-r border-blue-800 px-3 py-3 text-left font-bold text-white shadow-lg">
                  <span className="truncate">매장명</span>
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
                    const isManualInput = isManualInputRow(row);
                    const rowKey = getRowKey(row, idx);
                    
                    // 대리상 TOP3 여부 확인
                    const isTop3 = !isSummary && !isManualInput && row.type === 'detail' && 
                      (row as ShopRow).channel === 'FR' && 
                      top3FrShopIds.has((row as ShopRow).shop_id);
                    
                    // 행 배경색 결정
                    const getRowBg = () => {
                      if (isSummary) {
                        return 'bg-sky-100'; // 요약행: 하늘색
                      }
                      if (isManualInput) {
                        return 'bg-amber-50';
                      }
                      if (isTop3) {
                        return 'bg-yellow-100'; // TOP3: 노란색
                      }
                      return 'bg-white'; // 일반 매장행: 흰색
                    };

                    const rowBgColor = isSummary ? '#e0f2fe' : isManualInput ? '#fffbeb' : isTop3 ? '#fef9c3' : '#ffffff';

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
                              : isManualInput
                              ? 'text-amber-700 font-medium'
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
                              {/* 대리상/직영 요약 행에 펼치기 버튼 추가 */}
                              {(row.rowType === 'fr_avg' || row.rowType === 'fr_count') && row.rowType === 'fr_avg' && (
                                <button
                                  type="button"
                                  onClick={() => setCollapsedFR(prev => !prev)}
                                  className="ml-2 rounded-full border border-sky-400 bg-sky-50 px-2 py-0.5 text-xs text-sky-700 hover:bg-sky-100 transition-colors flex-shrink-0"
                                >
                                  {collapsedFR ? '펼치기' : '접기'}
                                </button>
                              )}
                              {(row.rowType === 'or_avg' || row.rowType === 'or_count') && row.rowType === 'or_avg' && (
                                <button
                                  type="button"
                                  onClick={() => setCollapsedOR(prev => !prev)}
                                  className="ml-2 rounded-full border border-blue-400 bg-blue-50 px-2 py-0.5 text-xs text-blue-700 hover:bg-blue-100 transition-colors flex-shrink-0"
                                >
                                  {collapsedOR ? '펼치기' : '접기'}
                                </button>
                              )}
                            </span>
                          ) : isManualInput ? (
                            <div className="flex items-center gap-2">
                              <span className="text-lg">📝</span>
                              <input
                                type="text"
                                value={manualNewFrNames[row.id] ?? row.shop_nm_ko}
                                onChange={(e) => handleNewFrNameChange(row.id, e.target.value)}
                                placeholder={`신규대리상(12월)_${row.id.replace('manual_fr_', '')}`}
                                className="flex-1 px-2 py-1 bg-white border-2 border-amber-300 rounded-lg text-sm font-medium text-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 transition-all duration-200 hover:border-amber-400 shadow-sm min-w-[150px]"
                              />
                            </div>
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
                          ) : isManualInput ? (
                            <span className="text-amber-600 font-medium">25.12</span>
                          ) : (
                            <span className="text-gray-600 font-medium">
                              {(row as ShopRow).open_month || '-'}
                            </span>
                          )}
                        </td>
                        
                        {/* 월별 매출 데이터 (25.01 ~ 25.11) */}
                        {months.slice(0, 11).map((month, monthIdx) => {
                          return (
                            <td
                              key={month}
                              className={`border-l border-gray-200 px-2 py-2 text-right text-gray-700 ${
                                isSummary ? 'font-bold' : 'font-medium'
                              }`}
                              style={{ backgroundColor: rowBgColor }}
                            >
                              <span className="block truncate">
                                {isManualInput 
                                  ? <span className="text-gray-400">-</span>
                                  : isSummary && (row.rowType === 'fr_count' || row.rowType === 'or_count')
                                    ? formatCount((row as SummaryRow).months[month])
                                    : formatNumber(isSummary ? (row as SummaryRow).months[month] : (row as ShopRow).months[month])
                                }
                              </span>
                            </td>
                          );
                        })}
                        
                        {/* 12월 (2025년만 수동 입력) */}
                        <td 
                          className={`border-l border-gray-200 px-2 py-2 text-right text-gray-700 ${
                            isSummary ? 'font-bold' : 'font-medium'
                          }`}
                          style={{ backgroundColor: rowBgColor }}
                        >
                          {selectedYear === '2025' ? (
                            // 2025년: 수기입력
                            isSummary ? (
                              <span className="block truncate">
                                {(row.rowType === 'fr_count' || row.rowType === 'or_count')
                                  ? formatCount((row as SummaryRow).months[months[11]])
                                  : formatNumber((row as SummaryRow).months[months[11]])
                                }
                              </span>
                            ) : isManualInput ? (
                              <input
                                type="text"
                                value={formatInputNumber(manualNewFrValues[row.id])}
                                onChange={(e) => handleNewFrValueChange(row.id, e.target.value)}
                                placeholder="0"
                                className="w-full px-1 py-1 bg-white border border-gray-300 rounded text-right text-sm font-medium text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 box-border"
                              />
                            ) : (
                              <input
                                type="text"
                                value={formatInputNumber(manualDecValues[rowKey])}
                                onChange={(e) => handleDecValueChange(rowKey, e.target.value)}
                                placeholder="0"
                                className="w-full px-1 py-1 bg-white border border-gray-300 rounded text-right text-sm font-medium text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 box-border"
                              />
                            )
                          ) : (
                            // 2023, 2024년: 일반 표시
                            <span className="block truncate">
                              {isSummary && (row.rowType === 'fr_count' || row.rowType === 'or_count')
                                ? formatCount((row as SummaryRow).months[months[11]])
                                : formatNumber(isSummary ? (row as SummaryRow).months[months[11]] : (row as ShopRow).months[months[11]])
                              }
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          </>
        )}

        {/* 하단 정보 및 새로고침 */}
        <div className="mt-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/60 backdrop-blur-sm rounded-xl p-4 shadow-md">
          <p className="text-sm text-gray-600 flex items-center gap-2">
            <span className="text-amber-500">💡</span>
            <span>
              {selectedYear === '2025' 
                ? '25.12 컬럼은 수동 입력입니다. 신규대리상 4개 행의 이름과 입력값은 새로고침해도 유지됩니다.' 
                : `${selectedYear}년 데이터를 표시하고 있습니다. (1~12월)`
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
              <ChinaMapChart brand="X" year={selectedYear} />
            </div>
          </section>
        )}

        {/* 대리상별 출고/판매 매출 표 */}
        {!loading && !error && (
          <DealerSalesTable brand="X" initialYear={selectedYear} />
        )}
      </div>
    </div>
  );
}
