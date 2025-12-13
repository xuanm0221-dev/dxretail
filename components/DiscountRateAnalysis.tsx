import { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface DiscountRateData {
  sale_ym: string;
  channel: string;
  discount_rate: number;
}

interface MonthlyData {
  month: string;
  monthLabel: string;
  FR: number | null;
  OR: number | null;
}

// 할인율 데이터를 가져오는 커스텀 훅
function useDiscountRateData() {
  const [data, setData] = useState<DiscountRateData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/discount-rate');
        const result = await response.json();
        
        if (!response.ok) {
          throw new Error(result.error || '데이터를 불러오는데 실패했습니다.');
        }
        
        setData(result);
        setError(null);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
        console.error('Fetch error:', err);
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return { data, loading, error };
}

export default function DiscountRateAnalysis() {
  const { data, loading, error } = useDiscountRateData();

  // 월별 데이터를 차트용 형식으로 변환
  const chartData = useMemo(() => {
    const months = ['2025-01', '2025-02', '2025-03', '2025-04', '2025-05', '2025-06', 
                    '2025-07', '2025-08', '2025-09', '2025-10'];
    
    const monthLabels: Record<string, string> = {
      '2025-01': '1월',
      '2025-02': '2월',
      '2025-03': '3월',
      '2025-04': '4월',
      '2025-05': '5월',
      '2025-06': '6월',
      '2025-07': '7월',
      '2025-08': '8월',
      '2025-09': '9월',
      '2025-10': '10월',
    };

    return months.map(month => {
      const frData = data.find(d => d.sale_ym === month && d.channel === 'FR');
      const orData = data.find(d => d.sale_ym === month && d.channel === 'OR');
      
      return {
        month: monthLabels[month],
        FR: frData ? frData.discount_rate * 100 : null,
        OR: orData ? orData.discount_rate * 100 : null,
      };
    });
  }, [data]);

  // 표용 데이터 계산
  const tableData = useMemo(() => {
    const frValues: number[] = [];
    const orValues: number[] = [];

    chartData.forEach(item => {
      if (item.FR !== null) frValues.push(item.FR);
      if (item.OR !== null) orValues.push(item.OR);
    });

    const frAvg = frValues.length > 0 
      ? frValues.reduce((sum, val) => sum + val, 0) / frValues.length 
      : 0;
    const orAvg = orValues.length > 0 
      ? orValues.reduce((sum, val) => sum + val, 0) / orValues.length 
      : 0;

    return {
      FR: {
        values: chartData.map(item => item.FR),
        avg: frAvg,
      },
      OR: {
        values: chartData.map(item => item.OR),
        avg: orAvg,
      },
    };
  }, [chartData]);

  // 툴팁 포맷터
  const formatTooltip = (value: number | null, name: string) => {
    if (value === null) return null;
    const label = name === 'FR' ? '대리상' : '직영점';
    return `${label}: ${value.toFixed(1)}%`;
  };

  // Y축 최대값 계산 (20%를 넘지 않도록)
  const yAxisMax = useMemo(() => {
    const allValues = chartData.flatMap(item => [item.FR, item.OR]).filter((val): val is number => val !== null);
    const maxValue = allValues.length > 0 ? Math.max(...allValues) : 20;
    return Math.min(Math.ceil(maxValue * 1.1), 20);
  }, [chartData]);

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow p-4">
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-200 border-t-[#5B8DEF] mb-4"></div>
          <p className="text-gray-600">데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 font-semibold">오류가 발생했습니다</p>
          <p className="text-red-600 text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* 차트 카드 */}
      <div className="bg-white rounded-xl shadow p-4">
        <h2 className="text-lg font-bold mb-4">대리상, 직영점 매장 할인율</h2>
        
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="month" 
              tick={{ fontSize: 12 }}
            />
            <YAxis 
              domain={[0, yAxisMax]}
              tick={{ fontSize: 12 }}
              label={{ value: '할인율 (%)', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip 
              formatter={formatTooltip}
              labelFormatter={(label) => `${label}`}
            />
            <Legend 
              verticalAlign="top" 
              align="center"
              wrapperStyle={{ paddingBottom: '10px' }}
            />
            <Line 
              type="monotone" 
              dataKey="FR" 
              name="대리상 평균 할인율"
              stroke="#3B82F6" 
              strokeWidth={2}
              dot={{ r: 5 }}
              activeDot={{ r: 7 }}
            />
            <Line 
              type="monotone" 
              dataKey="OR" 
              name="직영점 평균 할인율"
              stroke="#EF4444" 
              strokeWidth={2}
              dot={{ r: 5 }}
              activeDot={{ r: 7 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 할인율 표 */}
      <div className="bg-white rounded-xl shadow p-4 mt-4">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="bg-slate-100 font-semibold">
                <th className="border border-gray-300 px-4 py-3 text-left">채널</th>
                {chartData.map((item) => (
                  <th key={item.month} className="border border-gray-300 px-4 py-3 text-right">
                    {item.month}
                  </th>
                ))}
                <th className="border border-gray-300 px-4 py-3 text-right">평균</th>
              </tr>
            </thead>
            <tbody>
              {/* 대리상 행 */}
              <tr>
                <td className="border border-gray-300 px-4 py-3 font-medium text-blue-700">
                  대리상
                </td>
                {tableData.FR.values.map((value, idx) => (
                  <td key={idx} className="border border-gray-300 px-4 py-3 text-right">
                    {value !== null ? `${value.toFixed(1)}%` : '-'}
                  </td>
                ))}
                <td className="border border-gray-300 px-4 py-3 text-right font-semibold">
                  {tableData.FR.avg > 0 ? `${tableData.FR.avg.toFixed(1)}%` : '-'}
                </td>
              </tr>
              {/* 직영점 행 */}
              <tr>
                <td className="border border-gray-300 px-4 py-3 font-medium text-red-700">
                  직영점
                </td>
                {tableData.OR.values.map((value, idx) => (
                  <td key={idx} className="border border-gray-300 px-4 py-3 text-right">
                    {value !== null ? `${value.toFixed(1)}%` : '-'}
                  </td>
                ))}
                <td className="border border-gray-300 px-4 py-3 text-right font-semibold">
                  {tableData.OR.avg > 0 ? `${tableData.OR.avg.toFixed(1)}%` : '-'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}






