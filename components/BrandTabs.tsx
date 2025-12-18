import Link from 'next/link';
import { useRouter } from 'next/router';

interface BrandTabsProps {
  currentBrand: 'discovery' | 'mlb' | 'mlb-kids';
}

export default function BrandTabs({ currentBrand }: BrandTabsProps) {
  const router = useRouter();

  const brands = [
    { id: 'discovery', label: 'Discovery', href: '/', color: 'purple' },
    { id: 'mlb', label: 'MLB', href: '/mlb', color: 'blue' },
    { id: 'mlb-kids', label: 'MLB KIDS', href: '/mlb-kids', color: 'green' },
  ];

  return (
    <div className="flex items-center gap-2 bg-white rounded-xl px-2 py-2 shadow-sm border border-gray-200">
      {brands.map((brand) => {
        const isActive = currentBrand === brand.id;
        
        // 색상별 스타일
        const colorStyles = {
          purple: {
            active: 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-md',
            inactive: 'text-purple-600 hover:bg-purple-50'
          },
          blue: {
            active: 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md',
            inactive: 'text-blue-600 hover:bg-blue-50'
          },
          green: {
            active: 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-md',
            inactive: 'text-green-600 hover:bg-green-50'
          }
        };

        const style = colorStyles[brand.color as keyof typeof colorStyles];

        return (
          <Link key={brand.id} href={brand.href} legacyBehavior>
            <a
              className={`px-6 py-2.5 rounded-lg font-bold text-sm transition-all duration-200 ${
                isActive ? style.active : style.inactive
              }`}
            >
              {brand.label}
            </a>
          </Link>
        );
      })}
    </div>
  );
}

