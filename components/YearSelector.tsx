interface YearSelectorProps {
  selectedYear: string;
  onYearChange: (year: string) => void;
}

export default function YearSelector({ selectedYear, onYearChange }: YearSelectorProps) {
  const years = ['2023', '2024', '2025'];

  return (
    <div className="flex justify-center mb-6">
      <div className="inline-flex rounded-full bg-slate-100 p-1 shadow-inner">
        {years.map((year) => {
          const isActive = selectedYear === year;
          
          return (
            <button
              key={year}
              onClick={() => onYearChange(year)}
              className={`relative px-6 py-2.5 rounded-full text-sm font-bold transition-all duration-300 whitespace-nowrap ${
                isActive
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg scale-105'
                  : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50'
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

