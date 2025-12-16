import React, { useState, useEffect, useRef } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, FunnelChart, Funnel, LabelList, BarChart, Bar, Cell, PieChart, Pie, Legend
} from 'recharts';
import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";
import { createChatSession, sendMessageStream } from './services/geminiService';
import { SearchIcon, BellIcon, SendIcon, UploadIcon, TrendingUpIcon, TrendingDownIcon, BotIcon, CalendarIcon } from './components/Icons';
import { Product, ChatMessage } from './types';

// --- MOCK DATA GENERATORS ---

const PRODUCT_NAMES = [
  "特级新疆纯牛奶 200ml*12", "智利进口车厘子 JJ级", "东北五常大米 5kg", "维达超韧抽纸 4层", 
  "蓝月亮深层洁净洗衣液", "三只松鼠每日坚果", "海南贵妃芒 5斤装", "农夫山泉饮用天然水", 
  "蒙牛纯甄酸牛奶", "金龙鱼1:1:1调和油", "云南白药牙膏", "奥利奥夹心饼干", 
  "百事可乐无糖 330ml", "卫龙大面筋辣条", "帮宝适一级帮纸尿裤",
  "可口可乐 330ml*6", "康师傅红烧牛肉面", "海天生抽酱油 500ml", "清风卷纸 3层*10",
  "舒肤佳沐浴露 柠檬味", "高露洁牙刷 软毛", "立白洗洁精 1.5kg", "雀巢速溶咖啡 1+2",
  "百草味夏威夷果", "良品铺子芒果干", "旺旺雪饼", "乐事薯片 原味", "好丽友派",
  "伊利安慕希希腊酸奶", "王老吉凉茶"
];

const getRandomProduct = (index: number): Product => ({
  rank: index + 1,
  name: PRODUCT_NAMES[index % PRODUCT_NAMES.length] + (index > 14 ? ` (批次${Math.floor(index/15)})` : ""),
  orders: Math.floor(Math.random() * 5000) + 500,
  gmv: parseFloat((Math.random() * 20000 + 1000).toFixed(2)),
  trend: Math.random() > 0.4 ? 'up' : 'down'
});

const generateProductList = (count: number) => Array.from({ length: count }).map((_, i) => getRandomProduct(i));

const generateOverviewData = (metricType: number = 0) => {
  const times = ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', '23:59'];
  return times.map((time, i) => {
    let today = 0, yesterday = 0;
    
    // Simulate different data patterns based on metric type
    if (metricType === 0) { // GMV: Accumulating, large numbers
       const base = (i + 1) * 10000;
       today = base + Math.random() * 2000; 
       yesterday = base * 0.9 + Math.random() * 2000;
    } else if (metricType === 1) { // UV: Accumulating, medium numbers
       const base = (i + 1) * 800;
       today = base + Math.random() * 100;
       yesterday = base * 0.85 + Math.random() * 100;
    } else if (metricType === 2) { // Paid Buyers: Accumulating, small numbers
       const base = (i + 1) * 100;
       today = base + Math.random() * 20;
       yesterday = base * 0.9 + Math.random() * 20;
    } else if (metricType === 3) { // Conversion Rate: Fluctuating Percentage (10-15%)
       today = 12 + Math.random() * 3;
       yesterday = 11 + Math.random() * 3;
    } else { // Refund Rate: Fluctuating Percentage (2-5%)
       today = 2 + Math.random() * 1.5;
       yesterday = 2.5 + Math.random() * 1.5;
    }
    
    // Formatting
    if (metricType > 2) {
       today = parseFloat(today.toFixed(2));
       yesterday = parseFloat(yesterday.toFixed(2));
    } else {
       today = Math.floor(today);
       yesterday = Math.floor(yesterday);
    }
    
    return { time, today, yesterday };
  });
};

const getSubCategoryData = (index: number) => {
   const map = [
      [{name:'食用油', value: 8500}, {name:'大米杂粮', value: 6200}, {name:'厨房调味', value: 4500}, {name:'面粉面条', value: 3200}, {name:'方便食品', value: 2100}],
      [{name:'热带水果', value: 7800}, {name:'苹果/梨', value: 5600}, {name:'柑橘橙柚', value: 4200}, {name:'奇异果/莓', value: 3100}, {name:'车厘子', value: 2800}],
      [{name:'坚果炒货', value: 6500}, {name:'肉干肉脯', value: 5200}, {name:'饼干蛋糕', value: 4100}, {name:'膨化食品', value: 3300}, {name:'糖巧', value: 2400}],
      [{name:'牛肉', value: 5900}, {name:'羊肉', value: 4800}, {name:'猪肉', value: 4200}, {name:'禽肉', value: 3500}, {name:'蛋类', value: 3100}],
      [{name:'纯牛奶', value: 6800}, {name:'酸奶', value: 5400}, {name:'饮用水', value: 4500}, {name:'果汁', value: 3200}, {name:'啤酒', value: 2100}],
      [{name:'水饺/馄饨', value: 4200}, {name:'中式面点', value: 3800}, {name:'火锅丸料', value: 3100}, {name:'速冻半成品', value: 2500}, {name:'汤圆/元宵', value: 1800}],
   ];
   return map[index] || map[0];
};

const REFUND_REASONS = [
  { name: '商品质量问题', value: 35, fill: '#3b82f6' },
  { name: '物流破损', value: 25, fill: '#ef4444' },
  { name: '发错货/漏发', value: 25, fill: '#f59e0b' },
  { name: '不喜欢/拍错', value: 15, fill: '#10b981' },
];

// Channel Specific Data Generator
const generateChannelData = () => ({
  wechat: {
    funnel: [
      { value: Math.floor(Math.random() * 2000) + 7000, name: '访客数 (UV)', fill: '#3b82f6' },
      { value: Math.floor(Math.random() * 1000) + 3000, name: '加购人数', fill: '#10b981' },
      { value: Math.floor(Math.random() * 500) + 1500, name: '提交订单', fill: '#fbbf24' },
      { value: Math.floor(Math.random() * 300) + 1200, name: '支付成功', fill: '#60a5fa' },
    ],
    trend: Array.from({length: 7}, (_, i) => ({
       time: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i],
       click: Math.floor(Math.random() * 1000) + 1000,
       pay: Math.floor(Math.random() * 500) + 200
    })),
    products: generateProductList(25)
  },
  community: {
    funnel: [
      { value: Math.floor(Math.random() * 1000) + 4000, name: '访客数 (UV)', fill: '#3b82f6' },
      { value: Math.floor(Math.random() * 800) + 2000, name: '加购人数', fill: '#10b981' },
      { value: Math.floor(Math.random() * 400) + 1000, name: '提交订单', fill: '#fbbf24' },
      { value: Math.floor(Math.random() * 300) + 800, name: '支付成功', fill: '#60a5fa' },
    ],
    trend: Array.from({length: 7}, (_, i) => ({
       time: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i],
       click: Math.floor(Math.random() * 800) + 800,
       pay: Math.floor(Math.random() * 300) + 150
    })),
    products: generateProductList(25)
  },
  organic: {
    funnel: [
      { value: Math.floor(Math.random() * 3000) + 9000, name: '访客数 (UV)', fill: '#3b82f6' },
      { value: Math.floor(Math.random() * 500) + 1000, name: '加购人数', fill: '#10b981' },
      { value: Math.floor(Math.random() * 200) + 600, name: '提交订单', fill: '#fbbf24' },
      { value: Math.floor(Math.random() * 100) + 300, name: '支付成功', fill: '#60a5fa' },
    ],
    trend: Array.from({length: 7}, (_, i) => ({
       time: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i],
       click: Math.floor(Math.random() * 1500) + 1500,
       pay: Math.floor(Math.random() * 100) + 50
    })),
    products: generateProductList(25)
  }
});

// --- SHARED COMPONENTS ---

const Pagination = ({ current, total, pageSize, onChange }: { current: number, total: number, pageSize: number, onChange: (p: number) => void }) => {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;

  const getPageNumbers = () => {
    const pages = [];
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i);
    }
    return pages;
  };

  return (
    <div className="flex justify-end items-center gap-2 mt-4 select-none">
       <button 
        disabled={current === 1} 
        onClick={() => onChange(current - 1)} 
        className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
       >
         &lt;
       </button>
       
       <div className="flex items-center gap-1">
         {getPageNumbers().map(p => (
           <button
              key={p}
              onClick={() => onChange(p)}
              className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold transition-all ${
                current === p 
                  ? 'bg-brand-600 text-white shadow-md shadow-brand-200' 
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
           >
             {p}
           </button>
         ))}
       </div>

       <button 
        disabled={current === totalPages} 
        onClick={() => onChange(current + 1)} 
        className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
       >
         &gt;
       </button>
    </div>
  );
};

const Header = () => (
  <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-20">
    <div className="flex items-center gap-4">
      <div className="text-xl font-bold text-slate-800">生鲜智能BI报表</div>
      <div className="hidden md:flex relative">
        <input 
          type="text" 
          placeholder="搜索报表或指标..." 
          className="pl-8 pr-4 py-1.5 rounded-full bg-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 w-64"
        />
        <div className="absolute left-2.5 top-2 text-slate-400">
           <SearchIcon />
        </div>
      </div>
    </div>
    <div className="flex items-center gap-4 text-slate-500">
      <button className="hover:text-brand-600 transition-colors"><SearchIcon /></button>
      <button className="hover:text-brand-600 transition-colors"><BellIcon /></button>
      <div className="flex items-center gap-2 ml-4">
        <img src="https://picsum.photos/32/32" alt="User" className="w-8 h-8 rounded-full border border-slate-200" />
        <span className="text-sm font-medium text-slate-700">momo.zxy</span>
      </div>
    </div>
  </header>
);

const MetricCard = ({ title, value, subValue, trend, isActive, onClick, color = 'blue' }: any) => {
  return (
    <div 
      onClick={onClick}
      className={`p-4 rounded-xl border cursor-pointer transition-all duration-200 ${
        isActive ? 'border-brand-500 bg-brand-50 shadow-md ring-1 ring-brand-500' : 'border-slate-100 bg-slate-50 hover:bg-white hover:shadow-sm'
      }`}
    >
      <div className="text-sm text-slate-500 mb-1 font-medium">{title}</div>
      <div className="text-2xl font-bold text-slate-800 mb-2">{value}</div>
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>昨日 {subValue}</span>
        <div className="flex items-center gap-1">
          {trend && trend > 0 ? <TrendingUpIcon /> : <TrendingDownIcon />}
          <span className={trend > 0 ? "text-green-600" : "text-red-500"}>{Math.abs(trend)}%</span>
        </div>
      </div>
    </div>
  );
};

const SectionHeader = ({ title, filters = ['今日', '本周', '本月'], onDateChange }: { title: string, filters?: string[], onDateChange?: () => void }) => {
  const [startDate, setStartDate] = useState('2023-10-02');
  const [endDate, setEndDate] = useState('2023-10-10');

  const handleDateChange = (type: 'start' | 'end', val: string) => {
    if (type === 'start') setStartDate(val);
    else setEndDate(val);
    if (onDateChange) onDateChange();
  };

  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-lg font-bold text-slate-800 truncate mr-2">{title}</h2>
      <div className="flex items-center gap-1.5 text-sm shrink-0">
        {filters.map((f, i) => (
          <button key={f} className={`px-2 py-1 rounded-md transition-colors text-xs md:text-sm ${i === 0 ? 'bg-white shadow-sm text-brand-600 font-medium' : 'text-slate-500 hover:text-slate-800'}`}>
            {f}
          </button>
        ))}
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-md px-1 py-1 ml-1 text-slate-500 hover:border-brand-300 transition-colors">
          <CalendarIcon />
          <div className="flex items-center text-xs gap-0.5">
             <input 
               type="date" 
               value={startDate}
               onChange={(e) => handleDateChange('start', e.target.value)}
               className="bg-transparent border-none outline-none text-slate-600 p-0 cursor-pointer font-medium w-[85px] text-[11px]"
             />
             <span className="text-slate-400">~</span>
             <input 
               type="date" 
               value={endDate}
               onChange={(e) => handleDateChange('end', e.target.value)}
               className="bg-transparent border-none outline-none text-slate-600 p-0 cursor-pointer font-medium w-[85px] text-[11px]"
             />
          </div>
        </div>
      </div>
    </div>
  );
};

const SalesOverview = () => {
  const [activeMetric, setActiveMetric] = useState(0);
  const [chartData, setChartData] = useState(generateOverviewData(0));

  useEffect(() => {
    setChartData(generateOverviewData(activeMetric));
  }, [activeMetric]);

  const handleDataRefresh = () => {
    setChartData(generateOverviewData(activeMetric));
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-6">
      <SectionHeader title="数据概览" onDateChange={handleDataRefresh} />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <MetricCard title="总销售额 (GMV)" value="¥ 126,560" subValue="124,569" trend={12} isActive={activeMetric === 0} onClick={() => setActiveMetric(0)} />
        <MetricCard title="访客数 (UV)" value="8,560" subValue="6,850" trend={-5} isActive={activeMetric === 1} onClick={() => setActiveMetric(1)} />
        <MetricCard title="支付买家数" value="1,240" subValue="1,000" trend={24} isActive={activeMetric === 2} onClick={() => setActiveMetric(2)} />
        <MetricCard title="支付转化率" value="14.5%" subValue="13.2%" trend={1.3} isActive={activeMetric === 3} onClick={() => setActiveMetric(3)} />
        <MetricCard title="退款率" value="3.2%" subValue="4.1%" trend={-0.9} isActive={activeMetric === 4} onClick={() => setActiveMetric(4)} />
      </div>
      <div className="h-[420px] w-full bg-slate-50 rounded-xl p-4 relative">
        <div className="absolute top-4 right-4 z-10 flex gap-4 text-xs">
           <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-brand-500"></span>今日数据</div>
           <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sky-200"></span>昨日数据</div>
        </div>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorToday" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
            <Tooltip 
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              itemStyle={{ fontSize: '12px' }}
            />
            <Area type="monotone" dataKey="today" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorToday)" />
            <Area type="monotone" dataKey="yesterday" stroke="#bae6fd" strokeWidth={2} strokeDasharray="5 5" fill="transparent" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const GrowthFactors = () => {
  const [activeTab, setActiveTab] = useState<'wechat' | 'community' | 'organic'>('wechat');
  const [viewMode, setViewMode] = useState<'funnel' | 'trend'>('funnel');
  const [page, setPage] = useState(1);
  const pageSize = 5;
  const [channelData, setChannelData] = useState(generateChannelData());

  const handleDataRefresh = () => {
    setChannelData(generateChannelData());
  };

  const tabs = [
    { id: 'wechat', name: '企业微信渠道', value: '¥ 65,165', trend: '+12%', percent: 40 },
    { id: 'community', name: '社群团购渠道', value: '¥ 42,300', trend: '+8%', percent: 30 },
    { id: 'organic', name: '自然搜索流量', value: '¥ 19,095', trend: '-2%', percent: 15 },
  ] as const;

  const currentData = channelData[activeTab];
  
  useEffect(() => {
    setPage(1);
  }, [activeTab]);

  const pagedProducts = currentData.products.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-6">
      <SectionHeader title="销售增长因子" onDateChange={handleDataRefresh} />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {tabs.map((tab) => (
          <div 
            key={tab.id} 
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all duration-200 ${
              activeTab === tab.id 
                ? 'bg-brand-50 border-brand-500 shadow-md' 
                : 'bg-slate-50 border-slate-100 hover:border-brand-200'
            }`}
          >
             <div>
               <div className={`text-sm ${activeTab === tab.id ? 'text-brand-700 font-bold' : 'text-slate-500'}`}>{tab.name}</div>
               <div className="text-xl font-bold mt-1 text-slate-800">{tab.value}</div>
               <div className={`text-xs mt-1 ${tab.trend.includes('+') ? 'text-red-500' : 'text-green-500'}`}>日环比 {tab.trend}</div>
             </div>
             <div className={`w-12 h-12 rounded-full border-4 flex items-center justify-center text-xs font-bold ${
               activeTab === tab.id 
                 ? 'border-brand-200 border-t-brand-600 text-brand-600 bg-white' 
                 : 'border-slate-200 border-t-slate-400 text-slate-400'
             }`}>
               {tab.percent}%
             </div>
          </div>
        ))}
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fadeIn">
        <div className="h-[340px] flex flex-col">
          <div className="flex justify-between items-center mb-4">
             <h3 className="text-sm font-bold text-slate-700">{tabs.find(t=>t.id === activeTab)?.name} - 转化分析</h3>
             <div className="flex bg-slate-100 p-1 rounded-lg">
                <button 
                  onClick={() => setViewMode('funnel')}
                  className={`px-3 py-1 text-xs rounded-md transition-all ${viewMode === 'funnel' ? 'bg-white shadow-sm text-brand-600 font-bold' : 'text-slate-500'}`}
                >
                  漏斗图
                </button>
                <button 
                  onClick={() => setViewMode('trend')}
                  className={`px-3 py-1 text-xs rounded-md transition-all ${viewMode === 'trend' ? 'bg-white shadow-sm text-brand-600 font-bold' : 'text-slate-500'}`}
                >
                  趋势图
                </button>
             </div>
          </div>
          
          <div className="flex-1 relative">
            {viewMode === 'funnel' ? (
              <ResponsiveContainer width="100%" height="100%">
                <FunnelChart>
                  <Tooltip formatter={(value, name) => [value, name]} />
                  <Funnel dataKey="value" data={currentData.funnel} isAnimationActive={true}>
                    <LabelList position="right" fill="#000" stroke="none" dataKey="name" />
                  </Funnel>
                </FunnelChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                 <LineChart data={currentData.trend}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="click" name="点击用户数" stroke="#3b82f6" strokeWidth={2} dot={{r: 4}} />
                    <Line type="monotone" dataKey="pay" name="支付用户数" stroke="#10b981" strokeWidth={2} dot={{r: 4}} />
                 </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="h-[340px] flex flex-col">
          <div className="flex justify-between items-center mb-4">
             <h3 className="text-sm font-bold text-slate-700">该渠道核心商品贡献</h3>
             <div className="text-xs text-slate-400">排序: 支付金额</div>
          </div>
          <div className="flex-1 overflow-y-auto no-scrollbar">
            <div className="space-y-3">
              {pagedProducts.map((p) => (
                <div key={p.rank} className="flex items-center text-sm py-2 border-b border-slate-50 hover:bg-slate-50 px-2 rounded-lg transition-colors">
                  <span className={`w-5 h-5 flex items-center justify-center rounded text-xs font-bold mr-3 ${p.rank <= 3 ? 'bg-brand-500 text-white' : 'bg-slate-200 text-slate-600'}`}>{p.rank}</span>
                  <span className="flex-1 text-slate-700 truncate mr-4">{p.name}</span>
                  <span className="w-20 text-right text-slate-500">{p.orders}单</span>
                  <div className="w-24 text-right flex justify-end gap-1 items-center font-medium">
                     ¥{p.gmv} 
                     {p.trend === 'up' ? <TrendingUpIcon /> : <TrendingDownIcon />}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <Pagination 
            current={page} 
            total={currentData.products.length} 
            pageSize={pageSize} 
            onChange={setPage} 
          />
        </div>
      </div>
    </div>
  );
};

const RefundAnalysis = () => {
  const [page, setPage] = useState(1);
  const pageSize = 5;
  const [products, setProducts] = useState(() => generateProductList(25));
  const [chartData, setChartData] = useState(generateOverviewData(0));
  
  const handleDataRefresh = () => {
    setProducts(generateProductList(25));
    setChartData(generateOverviewData(0));
  };

  const pagedProducts = products.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-6">
      <SectionHeader title="售后与退款分析" onDateChange={handleDataRefresh} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
         <div className="p-4 bg-slate-50 rounded-xl relative overflow-hidden">
            <div className="relative z-10">
              <div className="text-sm text-slate-500">今日退款金额</div>
              <div className="text-2xl font-bold mt-1">¥ 6,165</div>
              <div className="flex gap-2 text-xs mt-2"><span className="text-green-600">▲ 12%</span> 较昨日</div>
            </div>
            <div className="absolute right-0 bottom-0 w-1/2 h-16 opacity-50">
               <ResponsiveContainer width="100%" height="100%">
                 <AreaChart data={chartData}>
                   <Area type="monotone" dataKey="today" stroke="#8b5cf6" fill="#c4b5fd" />
                 </AreaChart>
               </ResponsiveContainer>
            </div>
         </div>
         <div className="p-4 bg-slate-50 rounded-xl relative overflow-hidden">
            <div className="relative z-10">
              <div className="text-sm text-slate-500">今日退款单数</div>
              <div className="text-2xl font-bold mt-1">42单</div>
              <div className="flex gap-2 text-xs mt-2"><span className="text-green-600">▲ 5%</span> 较昨日</div>
            </div>
            <div className="absolute right-0 bottom-0 w-1/2 h-16 opacity-50">
               <ResponsiveContainer width="100%" height="100%">
                 <AreaChart data={chartData}>
                   <Area type="monotone" dataKey="today" stroke="#8b5cf6" fill="#c4b5fd" />
                 </AreaChart>
               </ResponsiveContainer>
            </div>
         </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="h-[280px] relative">
           <h3 className="text-sm font-bold mb-4">退款原因分布</h3>
           <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={REFUND_REASONS}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {REFUND_REASONS.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
           </ResponsiveContainer>
           <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none mt-2">
              <div className="text-2xl font-bold text-slate-800">100%</div>
              <div className="text-xs text-slate-400">占比</div>
           </div>
        </div>
        <div className="flex flex-col h-[280px]">
           <h3 className="text-sm font-bold mb-4">高退款商品</h3>
           <div className="flex-1 space-y-2 overflow-y-auto no-scrollbar">
            {pagedProducts.map((p) => (
              <div key={p.rank} className="flex items-center text-xs py-2 border-b border-slate-50">
                <span className="w-6 text-slate-400 font-bold">{p.rank}</span>
                <span className="flex-1 text-slate-600 truncate mr-2">{p.name}</span>
                <span className="w-20 text-right font-medium text-red-500">¥ {p.gmv}</span>
              </div>
            ))}
           </div>
           <Pagination current={page} total={products.length} pageSize={pageSize} onChange={setPage} />
        </div>
      </div>
    </div>
  );
};

// --- AI AGENT COMPONENT ---

const AIAgent = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatSessionRef = useRef<Chat | null>(null);

  // Initialize Chat Session
  useEffect(() => {
    try {
      if (!process.env.API_KEY) {
        console.error("API_KEY is missing!");
        setMessages([{
            id: 'error',
            role: 'model',
            text: "错误: 缺少 API_KEY 环境变量。",
            timestamp: new Date()
        }]);
        return;
      }
      chatSessionRef.current = createChatSession();
      // Initial greeting
      setMessages([{
        id: 'init',
        role: 'model',
        text: "你好！我是您的AI数据参谋。我可以协助分析今日销售、诊断退款异常、或生成经营日报。请问有什么可以帮您？",
        timestamp: new Date()
      }]);
    } catch (e) {
      console.error("Failed to init chat", e);
    }
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isLoading || !chatSessionRef.current) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: text,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    try {
      const result = await sendMessageStream(chatSessionRef.current, text);
      
      let fullResponse = '';
      const botMsgId = (Date.now() + 1).toString();
      
      // Add placeholder for streaming
      setMessages(prev => [...prev, {
        id: botMsgId,
        role: 'model',
        text: '思考中...',
        timestamp: new Date()
      }]);

      for await (const chunk of result) {
         const chunkText = (chunk as GenerateContentResponse).text;
         if (chunkText) {
            fullResponse += chunkText;
            setMessages(prev => prev.map(msg => 
              msg.id === botMsgId ? { ...msg, text: fullResponse } : msg
            ));
         }
      }
    } catch (error) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        text: "抱歉，处理您的请求时遇到了错误。",
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const QuickPrompt = ({ label, onClick }: { label: string, onClick: () => void }) => (
    <button 
      onClick={onClick}
      className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-full text-xs hover:bg-brand-100 hover:text-brand-600 transition-colors border border-slate-200"
    >
      {label}
    </button>
  );

  return (
    <div className="w-full lg:w-[380px] bg-white border-l border-slate-200 flex flex-col h-[calc(100vh-64px)] fixed right-0 bottom-0 z-30 shadow-xl lg:shadow-none">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white">
        <div className="flex items-center gap-2">
          <BotIcon />
          <span className="font-bold text-slate-800">AI 数据参谋</span>
        </div>
        <button className="text-slate-400 hover:text-slate-600"><span className="text-lg">⤢</span></button>
      </div>

      {/* Static Context Card */}
      <div className="p-4 bg-brand-50 mx-4 mt-4 rounded-xl border border-brand-100">
         <h4 className="text-xs font-bold text-brand-700 mb-2 uppercase tracking-wide">昨日核心指标</h4>
         <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-white p-2 rounded shadow-sm">
               <div className="text-slate-500">支付金额</div>
               <div className="font-bold">¥ 126,126</div>
            </div>
            <div className="bg-white p-2 rounded shadow-sm">
               <div className="text-slate-500">订单数</div>
               <div className="font-bold">1,310</div>
            </div>
            <div className="bg-white p-2 rounded shadow-sm">
               <div className="text-slate-500">退款额</div>
               <div className="font-bold">¥ 6,123</div>
            </div>
            <div className="bg-white p-2 rounded shadow-sm">
               <div className="text-slate-500">支付买家</div>
               <div className="font-bold">892</div>
            </div>
         </div>
         <p className="text-[10px] text-brand-600 mt-2 leading-relaxed">
            基于店铺实时数据，我可以提供运营诊断、结论总结和优化建议。支持生成日报/周报以及单品深度分析。
         </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
              msg.role === 'user' 
                ? 'bg-brand-600 text-white rounded-br-none' 
                : 'bg-slate-100 text-slate-800 rounded-bl-none'
            }`}>
              {msg.role === 'model' && msg.text === '思考中...' ? (
                 <span className="animate-pulse">AI思考中...</span>
              ) : (
                <div dangerouslySetInnerHTML={{ 
                  __html: msg.text.replace(/\n/g, '<br/>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') 
                }} />
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-white border-t border-slate-100">
         {messages.length < 3 && (
            <div className="flex flex-wrap gap-2 mb-3">
              <QuickPrompt label="生成日报" onClick={() => handleSendMessage("请基于昨日数据生成一份店铺经营日报，包含核心指标变化和异常分析。")} />
              <QuickPrompt label="退款分析" onClick={() => handleSendMessage("分析目前面板上显示的退款率过高的主要原因，并给出改进建议。")} />
              <QuickPrompt label="热销商品建议" onClick={() => handleSendMessage("列出当前的Top3热销商品，并针对每个商品给出增加连带率的营销建议。")} />
            </div>
         )}
         
        <div className="relative">
          <textarea
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-4 pr-12 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            rows={2}
            placeholder="向AI询问数据分析问题..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage(inputText);
              }
            }}
          />
          <div className="absolute right-2 bottom-2 flex gap-1">
             <button className="p-2 text-slate-400 hover:text-brand-600 transition-colors">
               <UploadIcon />
             </button>
             <button 
                onClick={() => handleSendMessage(inputText)}
                disabled={isLoading || !inputText.trim()}
                className={`p-2 rounded-lg transition-colors ${inputText.trim() ? 'bg-brand-600 text-white shadow-md' : 'bg-slate-200 text-slate-400'}`}
             >
               <SendIcon />
             </button>
          </div>
        </div>
        <div className="text-[10px] text-center text-slate-400 mt-2">
           AI生成内容可能存在误差，请以实际后台报表为准。
        </div>
      </div>
    </div>
  );
};

// Reusable Product Table Component with Pagination
const ProductTable = ({ title, products, type, onDateChange }: { title: string, products: Product[], type: 'top' | 'rising', onDateChange?: () => void }) => {
  const [page, setPage] = useState(1);
  const pageSize = 5;
  const pagedData = products.slice((page - 1) * pageSize, page * pageSize);

  return (
     <div className="border border-slate-200 rounded-xl p-5 flex flex-col h-full bg-slate-50/50">
       <SectionHeader title={title} onDateChange={onDateChange} />
       <div className="flex-1 overflow-auto no-scrollbar">
         <table className="w-full text-sm">
           <thead className="text-slate-500 text-xs bg-slate-50 border-b border-slate-100">
             <tr>
               <th className="py-3 text-left pl-2">排名</th>
               <th className="py-3 text-left">商品名称</th>
               <th className="py-3 text-right">销量</th>
               <th className="py-3 text-right pr-2">销售额</th>
             </tr>
           </thead>
           <tbody>
             {pagedData.map(p => (
               <tr key={p.rank} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                 <td className="py-3 pl-2 text-slate-500">{p.rank}</td>
                 <td className="py-3 text-brand-600 font-medium truncate max-w-[150px]">{p.name}</td>
                 <td className="py-3 text-right">{p.orders}</td>
                 <td className="py-3 text-right pr-2">¥{p.gmv} <span className={type === 'top' ? "text-green-500 text-[10px]" : "text-red-500 text-[10px]"}>{type === 'top' ? '↑' : '↓'}</span></td>
               </tr>
             ))}
           </tbody>
         </table>
       </div>
       <Pagination current={page} total={products.length} pageSize={pageSize} onChange={setPage} />
     </div>
  );
};

export default function App() {
  const [activeCategory, setActiveCategory] = useState(0);
  const [currentBarData, setCurrentBarData] = useState(getSubCategoryData(0));
  
  const [topProducts, setTopProducts] = useState(generateProductList(50));
  const [risingProducts, setRisingProducts] = useState(generateProductList(50));

  const handleCategoryChange = (index: number) => {
    setActiveCategory(index);
    setCurrentBarData(getSubCategoryData(index));
    setTopProducts(generateProductList(50));
    setRisingProducts(generateProductList(50));
  };

  const handleProductRefresh = () => {
    setTopProducts(generateProductList(50));
    setRisingProducts(generateProductList(50));
  };

  const categories = ['粮油调味', '生鲜水果', '休闲零食', '肉禽蛋品', '乳饮酒水', '速冻食品'];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      <Header />
      <div className="flex relative">
        {/* Main BI Content */}
        <main className="flex-1 p-6 lg:pr-[400px]">
          <div className="max-w-6xl mx-auto space-y-10"> {/* Changed from space-y-6 to space-y-10 */}
            <SalesOverview />
            <GrowthFactors />
            
            {/* Category Analysis Section */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <SectionHeader title="品类与库存分析" onDateChange={handleProductRefresh} />
              <div className="flex gap-4 overflow-x-auto pb-4 mb-4 no-scrollbar">
                {categories.map((cat, i) => (
                  <div 
                    key={i} 
                    onClick={() => handleCategoryChange(i)}
                    className={`min-w-[140px] p-3 rounded-lg border flex items-center gap-3 cursor-pointer transition-colors ${
                      i === activeCategory ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500' : 'border-slate-200 bg-white hover:border-brand-200'
                    }`}
                  >
                     <div className={`w-8 h-8 rounded-full flex items-center justify-center ${i===activeCategory ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                        <span className="text-xs font-bold">{cat[0]}</span>
                     </div>
                     <div>
                       <div className="text-xs text-slate-500">{cat}</div>
                       <div className="font-bold text-sm">¥ {Math.floor(Math.random()*50000)+50000}</div>
                     </div>
                  </div>
                ))}
              </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={currentBarData}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={80} tick={{fontSize: 12}} />
                    <Tooltip cursor={{fill: 'transparent'}} />
                    <Bar dataKey="value" barSize={12} radius={[0, 4, 4, 0]}>
                      {currentBarData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#3b82f6' : '#cbd5e1'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

               {/* Moved Product Tables here as requested */}
               <div className="mt-8 pt-8 border-t border-slate-100">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[420px]">
                     <ProductTable 
                        title="热销商品" 
                        products={topProducts} 
                        type="top" 
                        onDateChange={() => setTopProducts(generateProductList(50))} 
                     />
                     <ProductTable 
                        title="飙升商品" 
                        products={risingProducts} 
                        type="rising" 
                        onDateChange={() => setRisingProducts(generateProductList(50))} 
                     />
                  </div>
               </div>
            </div>

            <RefundAnalysis />
          </div>
        </main>

        {/* AI Sidebar */}
        <aside className="hidden lg:block w-[380px]">
          <AIAgent />
        </aside>
      </div>
    </div>
  );
}