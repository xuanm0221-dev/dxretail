import { useState, useEffect, useCallback, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';

// 중국 주요 도시 좌표 매핑 (시/성 접미사 포함)
const cityCoordinates: Record<string, [number, number]> = {
  '上海': [121.47, 31.23],
  '上海市': [121.47, 31.23],
  '北京': [116.40, 39.90],
  '北京市': [116.40, 39.90],
  '天津': [117.20, 39.13],
  '天津市': [117.20, 39.13],
  '重庆': [106.55, 29.56],
  '重庆市': [106.55, 29.56],
  '沈阳': [123.43, 41.80],
  '沈阳市': [123.43, 41.80],
  '长春': [125.32, 43.88],
  '长春市': [125.32, 43.88],
  '哈尔滨': [126.63, 45.75],
  '哈尔滨市': [126.63, 45.75],
  '大连': [121.62, 38.92],
  '大连市': [121.62, 38.92],
  '延吉': [129.51, 42.91],
  '延吉市': [129.51, 42.91],
  '延边朝鲜族自治州': [129.51, 42.91],
  '佳木斯': [130.32, 46.80],
  '佳木斯市': [130.32, 46.80],
  '白城': [122.84, 45.62],
  '白城市': [122.84, 45.62],
  '杭州': [120.15, 30.28],
  '杭州市': [120.15, 30.28],
  '南京': [118.78, 32.04],
  '南京市': [118.78, 32.04],
  '苏州': [120.62, 31.30],
  '苏州市': [120.62, 31.30],
  '无锡': [120.29, 31.59],
  '无锡市': [120.29, 31.59],
  '宁波': [121.55, 29.87],
  '宁波市': [121.55, 29.87],
  '合肥': [117.27, 31.86],
  '合肥市': [117.27, 31.86],
  '福州': [119.30, 26.08],
  '福州市': [119.30, 26.08],
  '厦门': [118.10, 24.46],
  '厦门市': [118.10, 24.46],
  '济南': [117.00, 36.65],
  '济南市': [117.00, 36.65],
  '青岛': [120.33, 36.07],
  '青岛市': [120.33, 36.07],
  '南昌': [115.89, 28.68],
  '南昌市': [115.89, 28.68],
  '广州': [113.26, 23.13],
  '广州市': [113.26, 23.13],
  '深圳': [114.06, 22.54],
  '深圳市': [114.06, 22.54],
  '东莞': [113.75, 23.05],
  '东莞市': [113.75, 23.05],
  '佛山': [113.12, 23.02],
  '佛山市': [113.12, 23.02],
  '珠海': [113.52, 22.27],
  '珠海市': [113.52, 22.27],
  '三亚': [109.51, 18.25],
  '三亚市': [109.51, 18.25],
  '海口': [110.35, 20.02],
  '海口市': [110.35, 20.02],
  '武汉': [114.31, 30.52],
  '武汉市': [114.31, 30.52],
  '长沙': [112.94, 28.23],
  '长沙市': [112.94, 28.23],
  '郑州': [113.65, 34.76],
  '郑州市': [113.65, 34.76],
  '太原': [112.55, 37.87],
  '太原市': [112.55, 37.87],
  '成都': [104.06, 30.67],
  '成都市': [104.06, 30.67],
  '昆明': [102.73, 25.04],
  '昆明市': [102.73, 25.04],
  '贵阳': [106.71, 26.57],
  '贵阳市': [106.71, 26.57],
  '南宁': [108.33, 22.84],
  '南宁市': [108.33, 22.84],
  '西安': [108.95, 34.27],
  '西安市': [108.95, 34.27],
  '兰州': [103.82, 36.06],
  '兰州市': [103.82, 36.06],
  '乌鲁木齐': [87.62, 43.82],
  '乌鲁木齐市': [87.62, 43.82],
  '银川': [106.23, 38.49],
  '银川市': [106.23, 38.49],
  '西宁': [101.78, 36.62],
  '西宁市': [101.78, 36.62],
};

// 도시명 중국어 → 한국어 매핑
const cityNameKoMap: Record<string, string> = {
  '上海': '상하이',
  '上海市': '상하이',
  '北京': '베이징',
  '北京市': '베이징',
  '天津': '톈진',
  '天津市': '톈진',
  '重庆': '충칭',
  '重庆市': '충칭',
  '沈阳': '선양',
  '沈阳市': '선양',
  '长春': '창춘',
  '长春市': '창춘',
  '哈尔滨': '하얼빈',
  '哈尔滨市': '하얼빈',
  '大连': '다롄',
  '大连市': '다롄',
  '延吉': '옌지',
  '延吉市': '옌지',
  '延边朝鲜族自治州': '옌지',
  '佳木斯': '자무쓰',
  '佳木斯市': '자무쓰',
  '白城': '바이청',
  '白城市': '바이청',
  '杭州': '항저우',
  '杭州市': '항저우',
  '南京': '난징',
  '南京市': '난징',
  '苏州': '쑤저우',
  '苏州市': '쑤저우',
  '无锡': '우시',
  '无锡市': '우시',
  '宁波': '닝보',
  '宁波市': '닝보',
  '合肥': '허페이',
  '合肥市': '허페이',
  '福州': '푸저우',
  '福州市': '푸저우',
  '厦门': '샤먼',
  '厦门市': '샤먼',
  '济南': '지난',
  '济南市': '지난',
  '青岛': '칭다오',
  '青岛市': '칭다오',
  '南昌': '난창',
  '南昌市': '난창',
  '广州': '광저우',
  '广州市': '광저우',
  '深圳': '선전',
  '深圳市': '선전',
  '东莞': '둥관',
  '东莞市': '둥관',
  '佛山': '포산',
  '佛山市': '포산',
  '珠海': '주하이',
  '珠海市': '주하이',
  '三亚': '싼야',
  '三亚市': '싼야',
  '海口': '하이커우',
  '海口市': '하이커우',
  '武汉': '우한',
  '武汉市': '우한',
  '长沙': '창사',
  '长沙市': '창사',
  '郑州': '정저우',
  '郑州市': '정저우',
  '太原': '타이위안',
  '太原市': '타이위안',
  '成都': '청두',
  '成都市': '청두',
  '昆明': '쿤밍',
  '昆明市': '쿤밍',
  '贵阳': '구이양',
  '贵阳市': '구이양',
  '南宁': '난닝',
  '南宁市': '난닝',
  '西安': '시안',
  '西安市': '시안',
  '兰州': '란저우',
  '兰州市': '란저우',
  '乌鲁木齐': '우루무치',
  '乌鲁木齐市': '우루무치',
  '银川': '인촨',
  '银川市': '인촨',
  '西宁': '시닝',
  '西宁市': '시닝',
};

// 도시 티어별 색상 (실제 데이터에 있는 T0~T5만)
const tierColors: Record<string, string> = {
  'T0': '#eab308',   // 노랑
  'T1': '#22c55e',   // 초록
  'T2': '#3b82f6',   // 파랑
  'T3': '#8b5cf6',   // 보라
  'T4': '#6b7280',   // 회색
  'T5': '#9ca3af',   // 연회색
  'default': '#64748b',
};

interface ShopInfo {
  shop_id: string;
  shop_nm_en: string;
  sale_amt: number;
  city_nm: string;
  city_tier_nm: string | null;
}

interface CityData {
  city_nm: string;
  city_tier_nm: string | null;
  total_sale_amt: number;
  shop_count: number;
  shops: ShopInfo[];
}

interface ProductTop {
  prdt_cd: string;
  prdt_nm_kr: string;
  sale_amt: number;
  tag_amt: number;
  discount_rate: number; // 할인율 (1 - sale_amt/tag_amt)
}

// 한국어 매장명 매핑 (CN 접두사 있는 버전과 없는 버전 모두 포함)
const shopNameKoMap: Record<string, string> = {
  // CN 접두사 있는 버전
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
  // CN 접두사 없는 버전 (API 응답 형식)
  '6385': '(창춘) 오야 마이창',
  '6382': '(하얼빈) 시청레드스퀘어',
  '6384': '(창춘) 오야 상두',
  '6383': '(타이위안) 완샹청',
  '6409': '(충칭) 베이청 티엔지에',
  '6410': '(난창) 완샹청',
  '6414': '(우한) 우샹 드림 몰',
  '6423': '(정저우) 정동 완샹청',
  '6424': '(베이징) IKEA',
  '6433': '(항저우) 룽후',
  '6428': '(옌지) 백화점',
  '6426': '(우루무치) MM1',
  '6435': '(자무쓰) 신마트',
  '6434': '(싼야) 국제 면세점 2단계',
  '6446': '(선양) 중싱 빌딩',
  '6452': '(항저우) 빌딩 쇼핑 시티',
  '6445': '(바이청) 유라시아 쇼핑센터',
  '6475': '(광저우) IGC',
  '1105': '(상하이) 완샹청',
  '1106': '(상하이) 환치우강',
  '1117': '(상하이) Century Link',
};

// K 단위 포맷 함수 (지도 버블용) - 천단위 콤마 포함
const formatToK = (num: number): string => {
  const kValue = Math.round(num / 1000);
  return `${new Intl.NumberFormat('ko-KR').format(kValue)}K`;
};

// 1위안 단위 콤마 포맷 함수 (TOP5 상품용)
const formatYuan = (num: number): string => {
  return new Intl.NumberFormat('ko-KR').format(Math.round(num));
};

interface ChinaMapChartProps {
  brand?: 'X' | 'M' | 'I'; // X=Discovery, M=MLB, I=MLB KIDS
  year?: string; // 2023, 2024, 2025
}

export default function ChinaMapChart({ brand = 'X', year = '2025' }: ChinaMapChartProps) {
  const [cityData, setCityData] = useState<CityData[]>([]);
  const [selectedCity, setSelectedCity] = useState<CityData | null>(null);
  const [selectedShop, setSelectedShop] = useState<ShopInfo | null>(null);
  const [productTop, setProductTop] = useState<ProductTop[]>([]);
  const [loading, setLoading] = useState(true);
  const [productLoading, setProductLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chartRef = useRef<ReactECharts>(null);
  
  // 당월/누적 탭 상태
  const [periodTab, setPeriodTab] = useState<'monthly' | 'cumulative'>('monthly');

  // 도시별 데이터 로드
  useEffect(() => {
    const fetchCityData = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/map-data?period=${periodTab}&brand=${brand}&year=${year}`);
        if (!response.ok) {
          throw new Error('데이터를 불러오는데 실패했습니다.');
        }
        const data = await response.json();
        setCityData(data);
        setError(null);
        // 탭 변경 시 선택 초기화
        setSelectedCity(null);
        setSelectedShop(null);
        setProductTop([]);
      } catch (err) {
        console.error('Error fetching city data:', err);
        setError(err instanceof Error ? err.message : '알 수 없는 오류');
      } finally {
        setLoading(false);
      }
    };

    fetchCityData();
  }, [periodTab, brand, year]);

  // 매장 클릭 시 상품 Top 5 로드
  const fetchProductTop = useCallback(async (shopId: string) => {
    try {
      setProductLoading(true);
      const response = await fetch(`/api/map-data?type=shop-products&shop_id=${shopId}&period=${periodTab}&brand=${brand}&year=${year}`);
      if (!response.ok) {
        throw new Error('상품 데이터를 불러오는데 실패했습니다.');
      }
      const data = await response.json();
      setProductTop(data);
    } catch (err) {
      console.error('Error fetching product data:', err);
      setProductTop([]);
    } finally {
      setProductLoading(false);
    }
  }, [periodTab, brand, year]);

  // 매장 선택 핸들러
  const handleShopSelect = useCallback((shop: ShopInfo) => {
    setSelectedShop(shop);
    fetchProductTop(shop.shop_id);
  }, [fetchProductTop]);

  // 도시 선택 핸들러 (지도 클릭)
  const handleCitySelect = useCallback((city: CityData) => {
    setSelectedCity(city);
    // 매장이 1개면 바로 선택
    if (city.shops.length === 1) {
      handleShopSelect(city.shops[0]);
    } else {
      setSelectedShop(null);
      setProductTop([]);
    }
  }, [handleShopSelect]);

  // 지도 로딩 상태
  const [mapLoaded, setMapLoaded] = useState(false);

  // 중국 지도 GeoJSON 등록 (로컬 파일 사용)
  useEffect(() => {
    fetch('/china.json')
      .then(res => {
        if (!res.ok) throw new Error('Failed to load map');
        return res.json();
      })
      .then(data => {
        echarts.registerMap('china', data);
        setMapLoaded(true);
      })
      .catch(err => {
        console.error('Failed to load China map:', err);
        setError('지도 데이터를 불러오는데 실패했습니다.');
      });
  }, []);

  // ECharts 옵션 생성 (도시 단위 버블)
  const getChartOption = useCallback(() => {
    const scatterData: any[] = [];
    const maxSale = Math.max(...cityData.map(c => c.total_sale_amt), 1);

    cityData.forEach(city => {
      const coords = cityCoordinates[city.city_nm];
      if (!coords) return;

      const cityNameKo = cityNameKoMap[city.city_nm] || city.city_nm;
      
      scatterData.push({
        name: cityNameKo,
        value: [coords[0], coords[1], city.total_sale_amt],
        cityData: city,
        itemStyle: {
          color: tierColors[city.city_tier_nm || 'default'] || tierColors.default,
        },
        symbolSize: Math.max(20, Math.min(60, (city.total_sale_amt / maxSale) * 60 + 15)),
      });
    });

    // 연도별 마지막 월 결정
    const yearPrefix = year.slice(-2);
    let lastMonth = '12';
    if (year === '2025' && (brand === 'M' || brand === 'I')) {
      lastMonth = '11';
    }
    
    const titleText = periodTab === 'monthly' 
      ? `도시별 매출 분포 (${yearPrefix}.${lastMonth} 당월)` 
      : `도시별 매출 분포 (${yearPrefix}.01~${yearPrefix}.${lastMonth} 누적)`;

    return {
      backgroundColor: '#f8fafc',
      title: {
        text: titleText,
        subtext: '버블 크기: 매출액 / 색상: 도시 티어',
        left: 'center',
        top: 20,
        textStyle: {
          color: '#1e3a5f',
          fontSize: 18,
          fontWeight: 'bold',
        },
        subtextStyle: {
          color: '#64748b',
          fontSize: 12,
        },
      },
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          const city = params.data?.cityData as CityData;
          if (!city) return '';
          const cityNameKo = cityNameKoMap[city.city_nm] || city.city_nm;
          return `
            <div style="font-weight: bold; margin-bottom: 4px;">${cityNameKo}</div>
            <div>티어: ${city.city_tier_nm || '-'}</div>
            <div>매출: ${formatToK(city.total_sale_amt)}</div>
            <div>매장수: ${city.shop_count}개</div>
            <div style="color: #6366f1; margin-top: 4px; font-size: 11px;">클릭하여 매장 선택</div>
          `;
        },
      },
      geo: {
        map: 'china',
        roam: true,
        zoom: 1.2,
        center: [105, 35],
        label: {
          show: false,
        },
        itemStyle: {
          areaColor: '#e2e8f0',
          borderColor: '#94a3b8',
          borderWidth: 0.5,
        },
        emphasis: {
          itemStyle: {
            areaColor: '#cbd5e1',
          },
          label: {
            show: false,
          },
        },
      },
      series: [
        {
          name: '도시',
          type: 'scatter',
          coordinateSystem: 'geo',
          data: scatterData,
          encode: {
            value: 2,
          },
          label: {
            show: false,
          },
          emphasis: {
            scale: 1.3,
          },
        },
      ],
      visualMap: {
        show: false,
      },
    };
  }, [cityData, periodTab]);

  // 클릭 이벤트 핸들러
  const onChartClick = useCallback((params: any) => {
    if (params.data?.cityData) {
      handleCitySelect(params.data.cityData);
    }
  }, [handleCitySelect]);

  const onEvents = {
    click: onChartClick,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 bg-white rounded-xl">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-gray-200 border-t-blue-500 mb-3"></div>
          <p className="text-gray-500">지도 데이터 로딩 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96 bg-red-50 rounded-xl border border-red-200">
        <div className="text-center text-red-600">
          <p className="text-lg font-semibold">오류 발생</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 당월/누적 탭 - 세련된 세그먼트 스타일 */}
      <div className="w-fit inline-flex rounded-full bg-slate-100 p-1 shadow-inner">
        <button
          onClick={() => setPeriodTab('monthly')}
          className={`relative px-4 py-2 rounded-full text-sm font-semibold transition-all duration-300 whitespace-nowrap ${
            periodTab === 'monthly'
              ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <span>📅</span>
            <span>당월 (25.11)</span>
          </span>
        </button>
        <button
          onClick={() => setPeriodTab('cumulative')}
          className={`relative px-4 py-2 rounded-full text-sm font-semibold transition-all duration-300 whitespace-nowrap ${
            periodTab === 'cumulative'
              ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <span>📊</span>
            <span>누적 (25.01~25.11)</span>
          </span>
        </button>
      </div>

      <div className="grid grid-cols-10 gap-4 h-[500px]">
        {/* 지도 영역 (6/10 = 60%) */}
        <div className="col-span-6 bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
          {!mapLoaded ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p className="text-gray-500">지도를 불러오는 중...</p>
              </div>
            </div>
          ) : (
            <ReactECharts
              ref={chartRef}
              option={getChartOption()}
              style={{ height: '100%', width: '100%' }}
              onEvents={onEvents}
              opts={{ renderer: 'canvas' }}
            />
          )}
        </div>

        {/* 우측 패널 (4/10 = 40%) */}
        <div className="col-span-4 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden flex flex-col">
          {/* 헤더 */}
          <div className="bg-gradient-to-r from-amber-400 to-amber-500 px-4 py-3 flex items-center gap-2">
            <span className="text-xl">🏆</span>
            <span className="text-white font-bold text-sm">
              {selectedCity 
                ? (cityNameKoMap[selectedCity.city_nm] || selectedCity.city_nm)
                : '도시 선택'}
            </span>
            <span className="ml-auto text-amber-100 text-xs">
              {periodTab === 'monthly' ? '당월' : '누적'} Top 5 상품
            </span>
          </div>

          {/* 매장 선택 드롭다운 (도시에 여러 매장이 있을 때) */}
          {selectedCity && selectedCity.shops.length > 1 && (
            <div className="p-3 border-b border-gray-200 bg-blue-50">
              <p className="text-xs text-blue-600 mb-2 font-medium">📍 매장 선택 ({selectedCity.shops.length}개)</p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {selectedCity.shops
                  .sort((a, b) => b.sale_amt - a.sale_amt)
                  .map((shop) => {
                    const isSelected = selectedShop?.shop_id === shop.shop_id;
                    const shopName = shopNameKoMap[shop.shop_id] || shop.shop_nm_en;
                    return (
                      <button
                        key={shop.shop_id}
                        onClick={() => handleShopSelect(shop)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                          isSelected
                            ? 'bg-blue-600 text-white'
                            : 'bg-white hover:bg-blue-100 text-gray-700'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <span className="truncate">{shopName}</span>
                          <span className={`text-xs ${isSelected ? 'text-blue-200' : 'text-gray-500'}`}>
                            {formatYuan(shop.sale_amt)}
                          </span>
                        </div>
                      </button>
                    );
                  })}
              </div>
            </div>
          )}

          {/* 상품 리스트 */}
          <div className="flex-1 overflow-y-auto p-3">
            {!selectedCity ? (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                <div className="text-center">
                  <div className="text-4xl mb-2">🗺️</div>
                  <p>지도에서 도시를 클릭하세요</p>
                </div>
              </div>
            ) : !selectedShop ? (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                <div className="text-center">
                  <div className="text-4xl mb-2">🏪</div>
                  <p>위에서 매장을 선택하세요</p>
                </div>
              </div>
            ) : productLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-200 border-t-amber-500"></div>
              </div>
            ) : productTop.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                <p>상품 데이터가 없습니다.</p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-gray-500 mb-2">
                  {shopNameKoMap[selectedShop.shop_id] || selectedShop.shop_nm_en}
                </p>
                {productTop.map((product, idx) => {
                  const rankColors = [
                    'bg-gradient-to-r from-yellow-400 to-amber-500 text-white',
                    'bg-gradient-to-r from-gray-300 to-gray-400 text-white',
                    'bg-gradient-to-r from-amber-600 to-amber-700 text-white',
                    'bg-gray-200 text-gray-600',
                    'bg-gray-100 text-gray-500',
                  ];
                  
                  return (
                    <div
                      key={product.prdt_cd}
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${rankColors[idx]}`}>
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate" title={product.prdt_nm_kr}>
                          {product.prdt_nm_kr}
                        </p>
                        <p className="text-xs text-gray-500">{product.prdt_cd}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-gray-800">
                          {formatYuan(product.sale_amt)}
                          <span className="text-xs text-red-500 ml-1">
                            ({product.discount_rate.toFixed(1)}%)
                          </span>
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 티어 범례 (T0~T5만) */}
          <div className="border-t border-gray-200 p-3 bg-gray-50">
            <p className="text-xs text-gray-500 mb-2">도시 티어 색상</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(tierColors).filter(([k]) => k !== 'default').map(([tier, color]) => (
                <div key={tier} className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }}></div>
                  <span className="text-xs text-gray-600">{tier}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
