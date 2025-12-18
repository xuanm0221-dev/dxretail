interface YearSelectorProps {
  selectedYear: string;
  onYearChange: (year: string) => void;
}

export default function YearSelector({ selectedYear, onYearChange }: YearSelectorProps) {
  const years = ['2023', '2024', '2025'];

  return (
    <div className="flex">
      <div className="inline-flex rounded-lg bg-gray-100 p-1 gap-1">
        {years.map((year) => {
          const isActive = selectedYear === year;
          
          return (
            <button
              key={year}
              onClick={() => onYearChange(year)}
              className={`relative px-5 py-2 rounded-md text-sm font-semibold transition-all duration-200 whitespace-nowrap ${
                isActive
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              {year}년
            </button>
          );
        })}
      </div>
    </div>
  );
}

