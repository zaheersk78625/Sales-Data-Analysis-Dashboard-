import { format, subDays } from 'date-fns';

export interface SaleRecord {
  id: string;
  date: string;
  category: 'Electronics' | 'Furniture' | 'Office Supplies' | 'Technology';
  region: 'North' | 'South' | 'East' | 'West';
  sales: number;
  profit: number;
  quantity: number;
  discount: number;
}

export const CATEGORIES = ['Electronics', 'Furniture', 'Office Supplies', 'Technology'] as const;
export const REGIONS = ['North', 'South', 'East', 'West'] as const;

function generateMockData(count: number): SaleRecord[] {
  const data: SaleRecord[] = [];
  const today = new Date();

  for (let i = 0; i < count; i++) {
    // 3 years of history
    const daysAgo = Math.floor(Math.random() * (365 * 3));
    const date = format(subDays(today, daysAgo), 'yyyy-MM-dd');
    const category = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
    const region = REGIONS[Math.floor(Math.random() * REGIONS.length)];
    
    const quantity = Math.floor(Math.random() * 8) + 1;
    const basePrice = Math.random() * 400 + 50;
    const sales = Number((basePrice * quantity).toFixed(2));
    const profit = Number((sales * (Math.random() * 0.2 + 0.1)).toFixed(2));
    const discount = Number((Math.random() * 0.15).toFixed(2));

    data.push({
      id: `ORD-${1000 + i}`,
      date,
      category,
      region,
      sales,
      profit,
      quantity,
      discount,
    });
  }
  return data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export function createRealTimeSale(): SaleRecord {
  const category = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
  const region = REGIONS[Math.floor(Math.random() * REGIONS.length)];
  const quantity = Math.floor(Math.random() * 5) + 1;
  const basePrice = Math.random() * 300 + 50;
  const sales = Number((basePrice * quantity).toFixed(2));
  
  return {
    id: `LIVE-${Math.floor(Math.random() * 9000) + 1000}`,
    date: format(new Date(), 'yyyy-MM-dd'),
    category,
    region,
    sales,
    profit: Number((sales * 0.2).toFixed(2)),
    quantity,
    discount: 0.05
  };
}

export const mockSalesData = generateMockData(800);
