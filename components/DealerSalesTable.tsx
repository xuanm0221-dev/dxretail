import { useState, useEffect, useMemo } from 'react';
import YearSelector from './YearSelector';

interface DealerData {
  account_id: string;
  account_nm_en: string;
  hq_sap_id: string;
  shipment_months: Record<string, number>;
  sales_months: Record<string, number>;
}

interface DealerSalesTableProps {
  brand: 'X' | 'M' | 'I';
  initialYear?: string;
}

export default function DealerSalesTable({ brand, initialYear = '2025' }: DealerSalesTableProps) {
  const [dealers, setDealers] = useState<DealerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState(initialYear);

  useEffect(() => {
    fetchData();
  }, [brand, selectedYear]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/dealer-sales?brand=${brand}&year=${selectedYear}`);
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || '데이터를 불러오는데 실패했습니다.');
      }
      
      setDealers(result.dealers || []);
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
      console.error('Fetch error:', err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // 월 배열 생성 (연도/브랜드에 따라)
  const months = useMemo(() => {
    const yearPrefix = selectedYear.slice(-2);
    let monthCount = 12;
    
    // 2025년 MLB, MLB KIDS는 11월까지만
    if (selectedYear === '2025' && (brand === 'M' || brand === 'I')) {
      monthCount = 11;
    }
    
    return Array.from({ length: monthCount }, (_, i) => {
      const monthNum = String(i + 1).padStart(2, '0');
      return {
        key: monthNum,
        label: `${i + 1}월`
      };
    });
  }, [selectedYear, brand]);

  // 데이터가 있는 대리상만 필터링
  const filteredDealers = useMemo(() => {
    return dealers.filter(dealer => {
      // 출고매출이나 판매매출 중 하나라도 값이 있으면 표시
      const hasShipmentData = months.some(month => {
        const value = dealer.shipment_months[month.key];
        return value !== null && value !== undefined && value > 0;
      });
      
      const hasSalesData = months.some(month => {
        const value = dealer.sales_months[month.key];
        return value !== null && value !== undefined && value > 0;
      });
      
      return hasShipmentData || hasSalesData;
    });
  }, [dealers, months]);

  const formatNumber = (num: number | null | undefined): string => {
    if (num === null || num === undefined || num === 0) return '-';
    return new Intl.NumberFormat('ko-KR').format(Math.round(num));
  };

  // CSV용 숫자 포맷 (소수점 2자리)
  const formatNumberForCSV = (num: number | null | undefined): string => {
    if (num === null || num === undefined) return '';
    if (num === 0) return '0.00';
    return num.toFixed(2);
  };

  // CSV 다운로드 함수
  const downloadCSV = () => {
    const brandName = brand === 'M' ? 'MLB' : brand === 'I' ? 'MLB_KIDS' : 'Discovery';
    const fileName = `대리상별_출고판매매출_${brandName}_${selectedYear}.csv`;
    
    // CSV 헤더 생성
    const headers = ['No.', '대리상명(코드)', '구분', ...months.map(m => m.label)];
    
    // CSV 데이터 행 생성
    const rows: string[][] = [];
    
    filteredDealers.forEach((dealer, idx) => {
      // SAP 코드 포맷: hq_sap_id가 있으면 표시, 없으면 account_id만 표시
      const codeDisplay = dealer.hq_sap_id 
        ? `(${dealer.account_id}, ${dealer.hq_sap_id.trim()})`
        : `(${dealer.account_id})`;
      
      // 출고매출 행
      const shipmentRow = [
        String(idx + 1),
        `${dealer.account_nm_en} ${codeDisplay}`,
        '출고매출',
        ...months.map(month => formatNumberForCSV(dealer.shipment_months[month.key]))
      ];
      rows.push(shipmentRow);
      
      // 판매매출 행
      const salesRow = [
        '', // No. 빈칸 (병합 효과)
        '', // 대리상명 빈칸 (병합 효과)
        '판매매출',
        ...months.map(month => formatNumberForCSV(dealer.sales_months[month.key]))
      ];
      rows.push(salesRow);
    });
    
    // CSV 문자열 생성 (UTF-8 BOM 포함)
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => {
        // 쉼표나 따옴표가 포함된 경우 따옴표로 감싸기
        if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
          return `"${cell.replace(/"/g, '""')}"`;
        }
        return cell;
      }).join(','))
    ].join('\n');
    
    // BOM 추가 (Excel 한글 호환)
    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
    
    // 다운로드 링크 생성 및 클릭
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-12 text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-blue-500 mb-4"></div>
        <p className="text-gray-600 text-lg">대리상 매출 데이터를 불러오는 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50/80 backdrop-blur-sm border-2 border-red-200 rounded-2xl p-6 shadow-lg">
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
    );
  }

  if (filteredDealers.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-12 text-center">
        <div className="text-6xl mb-4">📊</div>
        <p className="text-gray-600 text-lg">해당 연도에 데이터가 있는 대리상이 없습니다.</p>
      </div>
    );
  }

  // 브랜드별 색상 결정
  const getBrandColor = () => {
    switch (brand) {
      case 'M': // MLB
        return 'bg-blue-500';
      case 'I': // MLB KIDS
        return 'bg-green-500';
      case 'X': // Discovery
      default:
        return 'bg-purple-500';
    }
  };

  return (
    <section className="mt-8">
      {/* 섹션 제목 + 연도 선택 */}
      <div className="mb-6 bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-1 h-8 ${getBrandColor()} rounded-full`}></div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-gray-800">2. 대리상별 출고Tag/판매Tag</h2>
              <span className="text-sm text-gray-500">(총 {filteredDealers.length}개)</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={downloadCSV}
              className="px-4 py-2 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600 font-medium transition-colors duration-200 shadow-sm hover:shadow-md flex items-center gap-2"
              title="CSV 파일로 다운로드 (소수점 2자리)"
            >
              <span>📥</span>
              <span>CSV 다운로드</span>
            </button>
            <YearSelector 
              selectedYear={selectedYear} 
              onYearChange={(year) => setSelectedYear(year)} 
            />
          </div>
        </div>
        
        {/* 데이터 기준 안내 */}
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-500 leading-relaxed">
            <span className="font-semibold">데이터 원천:</span> 출고=dw_cn_copa_d.tag_sale_amt (채널84) + 판매=dw_sale.tag_amt (FR매장) + dw_shop_wh_detail (매장매핑) + mst_account (계정마스터) | 
            <span className="font-semibold ml-2">집계:</span> 월별·대리상별 합계, 소수점 2자리
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
        {/* 테이블 */}
        <div className="overflow-x-auto overflow-y-auto max-h-[600px]">
          <table className="border-collapse w-full" style={{ tableLayout: 'fixed', minWidth: '1600px' }}>
            <colgroup>
              <col style={{ width: '60px', minWidth: '60px' }} /> {/* No. */}
              <col style={{ width: '280px', minWidth: '280px' }} /> {/* 대리상명 */}
              <col style={{ width: '120px', minWidth: '120px' }} /> {/* 구분 */}
              {months.map((month) => (
                <col key={month.key} style={{ width: '100px', minWidth: '100px' }} />
              ))}
            </colgroup>

            {/* 고정 헤더 */}
            <thead className="sticky top-0 z-30">
              <tr className="bg-[#1E3A5F]">
                <th className="sticky left-0 z-40 bg-[#1E3A5F] border-r border-blue-800 px-2 py-3 text-center font-bold text-white shadow-lg">
                  No.
                </th>
                <th className="sticky left-[60px] z-40 bg-[#1E3A5F] border-r border-blue-800 px-4 py-3 text-left font-bold text-white shadow-lg">
                  대리상명 (코드)
                </th>
                <th className="sticky left-[340px] z-40 bg-[#1E3A5F] border-r border-blue-800 px-3 py-3 text-center font-bold text-white shadow-lg">
                  구분
                </th>
                {months.map((month) => (
                  <th
                    key={month.key}
                    className="px-3 py-3 text-center font-bold text-white border-l border-blue-800 bg-[#1E3A5F]"
                  >
                    {month.label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {filteredDealers.map((dealer, dealerIdx) => (
                <>
                  {/* 출고매출 행 */}
                  <tr 
                    key={`${dealer.account_id}-shipment`}
                    className={`border-b border-gray-200 hover:bg-blue-50 transition-colors ${
                      dealerIdx % 2 === 0 ? 'bg-blue-50/50' : 'bg-white'
                    }`}
                  >
                    {/* No. (2개 행 병합) */}
                    <td
                      rowSpan={2}
                      className="sticky left-0 border-r border-gray-300 px-2 py-3 text-center font-bold text-gray-700 shadow-md"
                      style={{ 
                        backgroundColor: dealerIdx % 2 === 0 ? '#eff6ff' : '#ffffff',
                        zIndex: 20
                      }}
                    >
                      {dealerIdx + 1}
                    </td>
                    
                    {/* 대리상명 (2개 행 병합) */}
                    <td
                      rowSpan={2}
                      className="sticky left-[60px] border-r border-gray-300 px-4 py-3 font-semibold text-gray-800 shadow-md"
                      style={{ 
                        backgroundColor: dealerIdx % 2 === 0 ? '#eff6ff' : '#ffffff',
                        zIndex: 20
                      }}
                    >
                      <div className="flex flex-col">
                        <span className="text-sm">{dealer.account_nm_en}</span>
                        <span className="text-xs text-gray-500">
                          {dealer.hq_sap_id 
                            ? `(${dealer.account_id}, ${dealer.hq_sap_id.trim()})`
                            : `(${dealer.account_id})`
                          }
                        </span>
                      </div>
                    </td>
                    
                    {/* 구분: 출고매출 */}
                    <td 
                      className="sticky left-[340px] border-r border-gray-300 px-3 py-2 text-center text-sm font-medium text-blue-700 bg-blue-100/50 shadow-md"
                      style={{ zIndex: 20 }}
                    >
                      출고매출
                    </td>
                    
                    {/* 월별 출고매출 */}
                    {months.map((month) => (
                      <td
                        key={month.key}
                        className="border-l border-gray-200 px-3 py-2 text-right text-sm text-gray-700"
                      >
                        {formatNumber(dealer.shipment_months[month.key])}
                      </td>
                    ))}
                  </tr>

                  {/* 판매매출 행 */}
                  <tr 
                    key={`${dealer.account_id}-sales`}
                    className={`border-b-2 border-gray-300 hover:bg-green-50 transition-colors ${
                      dealerIdx % 2 === 0 ? 'bg-green-50/30' : 'bg-white'
                    }`}
                  >
                    {/* 구분: 판매매출 */}
                    <td 
                      className="sticky left-[340px] border-r border-gray-300 px-3 py-2 text-center text-sm font-medium text-green-700 bg-green-100/50 shadow-md"
                      style={{ zIndex: 20 }}
                    >
                      판매매출
                    </td>
                    
                    {/* 월별 판매매출 */}
                    {months.map((month) => (
                      <td
                        key={month.key}
                        className="border-l border-gray-200 px-3 py-2 text-right text-sm text-gray-700"
                      >
                        {formatNumber(dealer.sales_months[month.key])}
                      </td>
                    ))}
                  </tr>
                </>
              ))}
            </tbody>
          </table>
        </div>

      </div>
      
      {/* 하단 정보 */}
      <div className="mt-2 text-sm text-gray-600 flex items-center gap-2">
        <span className="text-indigo-500">💡</span>
        <span>모든 금액은 1위안 단위로 표시됩니다. (천단위 콤마 포맷)</span>
      </div>
    </section>
  );
}

