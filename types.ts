export interface ChartDataPoint {
  time: string;
  value: number;
  value2?: number;
}

export interface Product {
  rank: number;
  name: string;
  orders: number;
  gmv: number;
  trend: 'up' | 'down' | 'stable';
}

export interface MetricCardProps {
  title: string;
  value: string;
  subValue?: string;
  trend?: number;
  trendLabel?: string;
  isActive?: boolean;
  onClick?: () => void;
  color?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}

export enum ReportType {
  DAILY = 'Daily Report',
  WEEKLY = 'Weekly Report',
  MONTHLY = 'Monthly Report',
  PRODUCT = 'Product Analysis'
}