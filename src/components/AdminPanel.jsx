import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Layers, 
  Layers3,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  LogOut, 
  Trash2, 
  Sparkles, 
  CheckCircle, 
  Search, 
  ShieldCheck, 
  Menu, 
  X,
  Copy,
  Check,
  Globe2,
  Save,
  RefreshCw,
  RotateCcw,
  WalletCards,
  Lock,
  ExternalLink,
  Phone,
  Mail,
  Send,
  Eye,
  Bot,
  Bell,
  MapPin,
  User,
  Image as ImageIcon,
  FolderTree,
  Shapes,
  Plus,
  Edit3,
  AlertCircle,
  Home,
  Utensils,
  Briefcase,
  GraduationCap,
  ShoppingBag,
  Car,
  Calendar,
  Tag,
  Laptop,
  Heart,
  BookOpen,
  Stethoscope,
  Music,
  Headphones,
  Hammer,
  Dumbbell
} from 'lucide-react';
import CloudflareTurnstile from './CloudflareTurnstile';
import { supabase } from '../lib/supabase';
import { adminApi, getMainSiteUrl } from '../lib/apiClient';
import { CATEGORIES, COUNTRIES, mergePortalCountries } from '../lib/translations';

// Architecture Constant: Maximum 10 records per view (Minimal Data Loading Rule)
const PAGE_SIZE = 10;

// Reusable Accessible Luxury Pagination Bar Component
function PaginationBar({ currentPage, totalCount, pageSize, onPageChange, loading }) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const startItem = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalCount);

  if (totalCount === 0) return null;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3 bg-stone-50/80 border-t border-stone-200/80 gap-3 select-none">
      <div className="text-xs text-stone-600 font-medium flex items-center gap-1.5">
        <span>نمایش</span>
        <span className="font-bold tabular-nums text-stone-900">{startItem}</span>
        <span>تا</span>
        <span className="font-bold tabular-nums text-stone-900">{endItem}</span>
        <span>از</span>
        <span className="font-bold tabular-nums text-blue-600">{totalCount}</span>
        <span>رکورد</span>
        {loading && <RefreshCw size={13} className="animate-spin text-blue-600 ms-1" />}
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={currentPage <= 1 || loading}
          onClick={() => onPageChange(currentPage - 1)}
          className="h-8.5 px-3 rounded-lg border border-stone-200 bg-white hover:bg-stone-100 disabled:opacity-40 disabled:pointer-events-none text-xs font-bold text-stone-700 flex items-center gap-1 active:scale-95 transition-all cursor-pointer shadow-2xs"
        >
          <ChevronRight size={14} />
          <span>قبلی</span>
        </button>

        <div className="flex items-center gap-1 px-1">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => {
            if (totalPages > 5 && Math.abs(p - currentPage) > 1 && p !== 1 && p !== totalPages) {
              if (p === 2 || p === totalPages - 1) {
                return <span key={p} className="text-stone-400 text-xs px-1">...</span>;
              }
              return null;
            }
            const isCurr = p === currentPage;
            return (
              <button
                key={p}
                type="button"
                disabled={loading}
                onClick={() => onPageChange(p)}
                className={`h-8 min-w-8 px-2 rounded-lg text-xs tabular-nums font-bold transition-all active:scale-95 cursor-pointer ${
                  isCurr
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-white border border-stone-200 text-stone-700 hover:bg-stone-100'
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          disabled={currentPage >= totalPages || loading}
          onClick={() => onPageChange(currentPage + 1)}
          className="h-8.5 px-3 rounded-lg border border-stone-200 bg-white hover:bg-stone-100 disabled:opacity-40 disabled:pointer-events-none text-xs font-bold text-stone-700 flex items-center gap-1 active:scale-95 transition-all cursor-pointer shadow-2xs"
        >
          <span>بعدی</span>
          <ChevronLeft size={14} />
        </button>
      </div>
    </div>
  );
}

// Real vector SVG flags for all supported countries (flawless on Windows & all OS)
const NORDIC_FLAGS = {
  se: (
    <svg className="w-5 h-3.5 rounded-[3px] shadow-2xs shrink-0 overflow-hidden" viewBox="0 0 16 10" aria-label="پرچم سوئد">
      <rect width="16" height="10" fill="#006aa7" />
      <rect width="2" height="10" x="5" fill="#fecc00" />
      <rect width="16" height="2" y="4" fill="#fecc00" />
    </svg>
  ),
  no: (
    <svg className="w-5 h-3.5 rounded-[3px] shadow-2xs shrink-0 overflow-hidden" viewBox="0 0 22 16" aria-label="پرچم نروژ">
      <rect width="22" height="16" fill="#ba0c2f" />
      <rect width="4" height="16" x="6" fill="#fff" />
      <rect width="22" height="4" y="6" fill="#fff" />
      <rect width="2" height="16" x="7" fill="#00205b" />
      <rect width="22" height="2" y="7" fill="#00205b" />
    </svg>
  ),
  dk: (
    <svg className="w-5 h-3.5 rounded-[3px] shadow-2xs shrink-0 overflow-hidden" viewBox="0 0 16 10" aria-label="پرچم دانمارک">
      <rect width="16" height="10" fill="#c8102e" />
      <rect width="2" height="10" x="5" fill="#fff" />
      <rect width="16" height="2" y="4" fill="#fff" />
    </svg>
  ),
  fi: (
    <svg className="w-5 h-3.5 rounded-[3px] shadow-2xs shrink-0 overflow-hidden border border-stone-200/70" viewBox="0 0 18 11" aria-label="پرچم فنلاند">
      <rect width="18" height="11" fill="#fff" />
      <rect width="3" height="11" x="5" fill="#003580" />
      <rect width="18" height="3" y="4" fill="#003580" />
    </svg>
  ),
  de: (
    <svg className="w-5 h-3.5 rounded-[3px] shadow-2xs shrink-0 overflow-hidden" viewBox="0 0 15 9" aria-label="پرچم آلمان">
      <rect width="15" height="3" y="0" fill="#000000" />
      <rect width="15" height="3" y="3" fill="#DD0000" />
      <rect width="15" height="3" y="6" fill="#FFCE00" />
    </svg>
  ),
  at: (
    <svg className="w-5 h-3.5 rounded-[3px] shadow-2xs shrink-0 overflow-hidden border border-stone-200/70" viewBox="0 0 15 9" aria-label="پرچم اتریش">
      <rect width="15" height="3" y="0" fill="#ED2939" />
      <rect width="15" height="3" y="3" fill="#FFFFFF" />
      <rect width="15" height="3" y="6" fill="#ED2939" />
    </svg>
  ),
  nl: (
    <svg className="w-5 h-3.5 rounded-[3px] shadow-2xs shrink-0 overflow-hidden border border-stone-200/70" viewBox="0 0 15 9" aria-label="پرچم هلند">
      <rect width="15" height="3" y="0" fill="#AE1C28" />
      <rect width="15" height="3" y="3" fill="#FFFFFF" />
      <rect width="15" height="3" y="6" fill="#21468B" />
    </svg>
  ),
  fr: (
    <svg className="w-5 h-3.5 rounded-[3px] shadow-2xs shrink-0 overflow-hidden border border-stone-200/70" viewBox="0 0 15 10" aria-label="پرچم فرانسه">
      <rect width="5" height="10" x="0" fill="#002395" />
      <rect width="5" height="10" x="5" fill="#FFFFFF" />
      <rect width="5" height="10" x="10" fill="#ED2939" />
    </svg>
  ),
};

function renderCountryFlag(id) {
  const code = String(id || 'se').toLowerCase();
  if (NORDIC_FLAGS[code]) return NORDIC_FLAGS[code];
  return (
    <span className="inline-flex items-center justify-center w-5 h-3.5 rounded-[3px] bg-stone-200 text-stone-700 font-mono text-[8px] font-black uppercase shrink-0">
      {code.slice(0, 2)}
    </span>
  );
}

// Category Icon Mapping
const CATEGORY_ICON_MAP = {
  Home,
  Utensils,
  Briefcase,
  GraduationCap,
  ShoppingBag,
  Car,
  Calendar,
  Tag,
  Laptop,
  Heart,
  BookOpen,
  Stethoscope,
  Music,
  Headphones,
  Hammer,
  Dumbbell,
  FolderTree,
  Layers
};

const AVAILABLE_CATEGORY_ICONS = [
  { name: 'Home', label: 'مسکن و خانه' },
  { name: 'Utensils', label: 'رستوران و خوراک' },
  { name: 'Briefcase', label: 'خدمات و کار' },
  { name: 'GraduationCap', label: 'آموزش و تحصیل' },
  { name: 'ShoppingBag', label: 'خرید و فروش' },
  { name: 'Car', label: 'خودرو و نقلیه' },
  { name: 'Calendar', label: 'رویداد و مراسم' },
  { name: 'Laptop', label: 'دیجیتال و فناوری' },
  { name: 'Heart', label: 'سلامت و زیبایی' },
  { name: 'BookOpen', label: 'فرهنگ و کتاب' },
  { name: 'Stethoscope', label: 'پزشکی و بهداشت' },
  { name: 'Music', label: 'موسیقی و هنر' },
  { name: 'Hammer', label: 'فنی و ساختمانی' },
  { name: 'Dumbbell', label: 'ورزش و سرگرمی' },
  { name: 'Tag', label: 'عمومی و سایر' },
];

const DEFAULT_CATEGORIES = [
  { id: 'bostad', fa: 'مسکن', icon: 'Home', enabled: true, isSystem: true, order: 1 },
  { id: 'restaurang', fa: 'رستوران', icon: 'Utensils', enabled: true, isSystem: true, order: 2 },
  { id: 'tjanster', fa: 'خدمات', icon: 'Briefcase', enabled: true, isSystem: true, order: 3 },
  { id: 'jobb', fa: 'استخدام', icon: 'GraduationCap', enabled: true, isSystem: true, order: 4 },
  { id: 'kop-salj', fa: 'خرید و فروش', icon: 'ShoppingBag', enabled: true, isSystem: true, order: 5 },
  { id: 'fordon', fa: 'خودرو', icon: 'Car', enabled: true, isSystem: true, order: 6 },
  { id: 'elektronik', fa: 'وسایل الکترونیکی', icon: 'Laptop', enabled: true, isSystem: true, order: 7 },
  { id: 'evenemang', fa: 'رویدادها', icon: 'Calendar', enabled: true, isSystem: true, order: 8 },
  { id: 'ovrigt', fa: 'سایر', icon: 'Tag', enabled: true, isSystem: true, order: 9 },
];

export default function AdminPanel({ onClose, onRefreshAds }) {
  // Authentication with signed token session persistence
  const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(adminApi.getToken()));
  const [adminEmailInput, setAdminEmailInput] = useState('swedpersiska@gmail.com');
  const [adminPassInput, setAdminPassInput] = useState('');
  const [showAdminPass, setShowAdminPass] = useState(false);
  const [loginSubmitting, setLoginSubmitting] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loading, setLoading] = useState(false);

  // Active view: 'overview' | 'ads' | 'categories' | 'settings' with URL & localStorage persistence
  const [settingsSubTab, setSettingsSubTab] = useState(() => {
    try {
      const p = new URLSearchParams(window.location.search).get('tab');
      if (p === 'monetization' || p === 'security') return p;
    } catch {}
    return 'general';
  });
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const validTabs = ['overview', 'ads', 'websites', 'categories', 'settings', 'reports'];
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam === 'monetization' || tabParam === 'security') {
        return 'settings';
      }
      if (tabParam && validTabs.includes(tabParam)) {
        return tabParam;
      }
      const saved = localStorage.getItem('swedpersiska_admin_tab');
      if (saved && validTabs.includes(saved)) {
        return saved;
      }
    } catch {}
    return 'overview';
  });
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const handleTabChange = (tab) => {
    playFeedback('click');
    let targetTab = tab;
    if (tab === 'monetization' || tab === 'security') {
      targetTab = 'settings';
      setSettingsSubTab(tab);
    }
    setActiveTab(targetTab);
    setMobileSidebarOpen(false);
    try {
      localStorage.setItem('swedpersiska_admin_tab', targetTab);
      const url = new URL(window.location.href);
      url.searchParams.set('tab', targetTab);
      window.history.replaceState({ modal: 'admin', tab: targetTab }, '', url.toString());
    } catch {}
  };

  // Categories Management State
  const [categoriesList, setCategoriesList] = useState(() => {
    try {
      const saved = localStorage.getItem('swedpersiska_portal_categories');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_CATEGORIES;
  });
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const [categoryStatusFilter, setCategoryStatusFilter] = useState('all'); // 'all' | 'active' | 'disabled' | 'has_ads'
  const [catalogSubTab, setCatalogSubTab] = useState('categories'); // 'categories' | 'cities'
  const [countriesList, setCountriesList] = useState(() => {
    try {
      const saved = localStorage.getItem('swedpersiska_portal_countries');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return mergePortalCountries(parsed);
      }
    } catch {}
    return mergePortalCountries();
  });
  const [newCountryOpen, setNewCountryOpen] = useState(false);
  const [newCountryForm, setNewCountryForm] = useState({
    id: '',
    nameFa: '',
    currency: '€',
    heroImage: '',
    citiesText: ''
  });
  const [citiesByCountry, setCitiesByCountry] = useState(() => {
    const initial = {};
    COUNTRIES.forEach(c => {
      initial[c.id] = (c.cities || [])
        .filter(city => city.id !== 'all')
        .map(city => ({ id: city.id, fa: city.fa, enabled: true, isSystem: true }));
    });
    try {
      const saved = localStorage.getItem('swedpersiska_portal_cities');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return { ...initial, ...parsed };
        }
      }
    } catch {}
    return initial;
  });
  const [cityCountryFilter, setCityCountryFilter] = useState('se');
  const [citySearchQuery, setCitySearchQuery] = useState('');
  const [cityModal, setCityModal] = useState({
    isOpen: false,
    mode: 'add',
    countryId: 'se',
    originalId: '',
    id: '',
    fa: '',
    enabled: true,
    errorMsg: ''
  });
  const [cityToDelete, setCityToDelete] = useState(null);
  const [categoryModal, setCategoryModal] = useState({
    isOpen: false,
    mode: 'add', // 'add' | 'edit'
    id: '',
    fa: '',
    icon: 'Home',
    enabled: true,
    isSystem: false,
    errorMsg: ''
  });
  const [categoryToDelete, setCategoryToDelete] = useState(null);

  // Ads state
  // Architecture State (Minimal Data Loading Rule: 10 per view)
  const [counts, setCounts] = useState({
    total: 0,
    active: 0,
    pending: 0,
    vip: 0,
    totalViews: 0
  });
  const [adStatusFilter, setAdStatusFilter] = useState('active');
  const [vipOnlyFilter, setVipOnlyFilter] = useState(false);
  const [adReports, setAdReports] = useState([]);
  const [countryStats, setCountryStats] = useState({
    se: { total: 0, active: 0, vip: 0, views: 0 },
    no: { total: 0, active: 0, vip: 0, views: 0 },
    dk: { total: 0, active: 0, vip: 0, views: 0 },
    fi: { total: 0, active: 0, vip: 0, views: 0 }
  });
  const [categoryCounts, setCategoryCounts] = useState({});
  const [monthBuckets, setMonthBuckets] = useState({});
  const [revenueChartView, setRevenueChartView] = useState('monthly'); // 'monthly' | 'country'
  const [activeChartIdx, setActiveChartIdx] = useState(null);
  const [recentActiveAds, setRecentActiveAds] = useState([]);

  // Active Ads Tab State (10 records page size, database-paginated)
  const [activeAds, setActiveAds] = useState([]);
  const [activeTotalCount, setActiveTotalCount] = useState(0);
  const [activePage, setActivePage] = useState(1);
  const [activeLoading, setActiveLoading] = useState(false);

  // Filters for Active Ads
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef(null);
  const topSearchRef = useRef(null);
  const mainScrollRef = useRef(null);
  const toastTimerRef = useRef(null);
  const searchDebounceRef = useRef(null);
  const [countryFilter, setCountryFilter] = useState('all'); // 'all' | 'se' | 'no' | 'dk' | 'fi' | 'de' | 'at' | 'nl' | 'fr'
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Centered Detail Modal & Toast State
  const [selectedAdForModal, setSelectedAdForModal] = useState(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef(null);
  const [copiedKey, setCopiedKey] = useState(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState('');
  const [actionToastType, setActionToastType] = useState('success');

  // Site Branding State
  const [siteName, setSiteName] = useState('لینک شو');
  const [siteSlogan, setSiteSlogan] = useState('محل رشد کسب و کار فارسی‌زبانان');
  const [logoUrl, setLogoUrl] = useState('');
  const [faviconUrl, setFaviconUrl] = useState('');
  const [uploadingBrandKey, setUploadingBrandKey] = useState(null);
  const [supportEmail, setSupportEmail] = useState('swedpersiska@gmail.com');
  const [supportTelegram, setSupportTelegram] = useState('@SwedPersiska');
  const [supportPhone, setSupportPhone] = useState('');
  const [socialInstagram, setSocialInstagram] = useState('https://instagram.com');
  const [socialTelegram, setSocialTelegram] = useState('https://t.me');
  const [socialWhatsapp, setSocialWhatsapp] = useState('');
  const [socialYoutube, setSocialYoutube] = useState('');
  const [socialLinkedin, setSocialLinkedin] = useState('');

  // SEO Settings State (Per Country — Complete & Synced with Frontend)
  const DEFAULT_COUNTRY_SEO = {
    se: {
      title: 'لینک شو سوئد | نیازمندی‌ها، مسکن، کاریابی و خدمات فارسی‌زبانان در سوئد',
      description: 'لینک شو — مرجع نیازمندی‌ها و آگهی‌های رایگان فارسی‌زبانان در سوئد (استکهلم، گوتنبرگ، مالمو، اوپسالا). اجاره مسکن، رستوران، استخدام و خدمات تخصصی.',
      keywords: 'لینک شو, نیازمندیهای سوئد, فارسی زبانان سوئد, اجاره خانه استکهلم, کار در سوئد, رستوران ایرانی گوتنبرگ',
      heroHeading: 'نیازمندی‌های فارسی‌زبانان سوئد',
      heroSubheading: 'مسکن، رستوران، خدمات و کاریابی در سراسر سوئد',
      ogTitle: 'لینک شو سوئد | مرجع نیازمندی‌های فارسی‌زبانان در سوئد',
      ogDescription: 'ثبت و جستجوی مستقیم و رایگان مسکن، کار، رستوران و خدمات در استکهلم، گوتنبرگ و سراسر سوئد.'
    },
    no: {
      title: 'لینک شو نروژ | نیازمندی‌ها، مسکن، کاریابی و خدمات فارسی‌زبانان در نروژ',
      description: 'لینک شو — مرجع نیازمندی‌ها و آگهی‌های رایگان فارسی‌زبانان در نروژ (اسلو، برگن، استاوانگر، تروندهایم). مسکن، کاریابی، رستوران و خدمات.',
      keywords: 'لینک شو, نیازمندیهای نروژ, فارسی زبانان نروژ, اجاره خانه اسلو, کار در نروژ, خدمات ایرانی نروژ',
      heroHeading: 'نیازمندی‌های فارسی‌زبانان نروژ',
      heroSubheading: 'مسکن، رستوران، خدمات و کاریابی در سراسر نروژ',
      ogTitle: 'لینک شو نروژ | مرجع نیازمندی‌های فارسی‌زبانان در نروژ',
      ogDescription: 'ثبت و جستجوی مستقیم و رایگان مسکن، کار، رستوران و خدمات در اسلو، برگن و سراسر نروژ.'
    },
    dk: {
      title: 'لینک شو دانمارک | نیازمندی‌ها، مسکن، کاریابی و خدمات فارسی‌زبانان در دانمارک',
      description: 'لینک شو — مرجع نیازمندی‌ها و آگهی‌های رایگان فارسی‌زبانان در دانمارک (کپنهاگ، آرهوس، اودنسه، آلبورگ). مسکن، استخدام، رستوران و خدمات.',
      keywords: 'لینک شو, نیازمندیهای دانمارک, فارسی زبانان دانمارک, مسکن کپنهاگ, کار در دانمارک, خدمات ایرانی کپنهاگ',
      heroHeading: 'نیازمندی‌های فارسی‌زبانان دانمارک',
      heroSubheading: 'مسکن، رستوران، خدمات و کاریابی در سراسر دانمارک',
      ogTitle: 'لینک شو دانمارک | مرجع نیازمندی‌های فارسی‌زبانان در دانمارک',
      ogDescription: 'ثبت و جستجوی مستقیم و رایگان مسکن، کار، رستوران و خدمات در کپنهاگ، آرهوس و سراسر دانمارک.'
    },
    fi: {
      title: 'لینک شو فنلاند | نیازمندی‌ها، مسکن، کاریابی و خدمات فارسی‌زبانان در فنلاند',
      description: 'لینک شو — مرجع نیازمندی‌ها و آگهی‌های رایگان فارسی‌زبانان در فنلاند (هلسینکی، اسپو، تامپره، تورکو). مسکن، کاریابی، رستوران و خدمات.',
      keywords: 'لینک شو, نیازمندیهای فنلاند, فارسی زبانان فنلاند, مسکن هلسینکی, کار در فنلاند, خدمات ایرانی هلسینکی',
      heroHeading: 'نیازمندی‌های فارسی‌زبانان فنلاند',
      heroSubheading: 'مسکن، رستوران، خدمات و کاریابی در سراسر فنلاند',
      ogTitle: 'لینک شو فنلاند | مرجع نیازمندی‌های فارسی‌زبانان در فنلاند',
      ogDescription: 'ثبت و جستجوی مستقیم و رایگان مسکن، کار، رستوران و خدمات در هلسینکی، اسپو و سراسر فنلاند.'
    }
  };
  const [seoActiveCountry, setSeoActiveCountry] = useState('se');
  const [seoSettings, setSeoSettings] = useState(DEFAULT_COUNTRY_SEO);

  // Stripe & VIP Monetization State
  const [stripeSettings, setStripeSettings] = useState({
    enabled: true,
    mode: 'test', // 'test' | 'live'
    publishableKey: '',
    secretKey: '',
    webhookSecret: '',
    vipPrice: 99,
    currency: 'SEK',
    vipDurationDays: 30,
    vipBadgeText: 'ویژه (VIP)'
  });

  // Cloudflare Turnstile Anti-Bot State
  const [turnstileSettings, setTurnstileSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('swedpersiska_turnstile_settings');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      enabled: true,
      mode: 'test', // 'test' | 'live'
      siteKey: '',
      secretKey: '',
      protectAdminLogin: true,
      protectPostAd: true
    };
  });

  // Google Analytics (GA4) State
  const [analyticsSettings, setAnalyticsSettings] = useState({
    enabled: false,
    measurementId: ''
  });

  // Cloudflare R2 Storage State
  const [r2Settings, setR2Settings] = useState({
    enabled: false,
    accountId: '',
    accessKeyId: '',
    secretAccessKey: '',
    bucketName: '',
    publicUrl: '',
    hasCredentials: false
  });

  // News Podcast & YouTube Feed State
  const [podcastSettings, setPodcastSettings] = useState({
    enabled: true,
    title: 'پادکست خبری لینک شو',
    subtitle: 'تازه‌ترین گزارش‌ها و پادکست‌های خبری فارسی‌زبانان اروپا',
    youtubeChannelUrl: '',
    youtubeChannelId: '',
    manualVideos: []
  });
  const [newPodcastVideoUrl, setNewPodcastVideoUrl] = useState('');
  const [newPodcastVideoTitle, setNewPodcastVideoTitle] = useState('');
  const [sellerDeployments, setSellerDeployments] = useState([]);
  const [deletingDeployment, setDeletingDeployment] = useState('');
  const [cfDeploySettings, setCfDeploySettings] = useState({
    apiToken: '',
    accountId: '',
    deployUrl: 'https://linksho-seller.vercel.app/api/cloudflare/deploy',
    hasToken: false
  });
  const [cfTestStatus, setCfTestStatus] = useState(null);
  const [testingCf, setTestingCf] = useState(false);

  const [adminTurnstileToken, setAdminTurnstileToken] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  // Toast Helper (supports 'success' and 'error' confirmation popup)
  const triggerToast = (msg, type = 'success') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setActionToastType(type);
    setActionSuccessMsg(msg);
    toastTimerRef.current = setTimeout(() => {
      setActionSuccessMsg('');
    }, 3800);
  };

  // Zero-CPU feedback stub (avoids spawning unclosed WebAudio hardware threads)
  const playFeedback = () => {};

  // 1. Fetch Overview & Aggregates via Secure Admin API (with Supabase fallback)
  const applySettingsItems = (items) => {
    if (!items || !Array.isArray(items)) return;
    items.forEach(item => {
      if (item.key === 'site_branding' && item.value) {
        const rawName = (item.value.siteName || '').trim();
        const isLegacy = !rawName || /سوئد\s*پرشیا|سوید\s*پرشیا|پرشیا\s*سو|فارسی\s*نور|swedpersiska|farsi\s*nord|faris\s*nord/i.test(rawName);
        setSiteName(isLegacy ? 'لینک شو' : rawName);
        setSiteSlogan(item.value.siteSlogan || '');
        setLogoUrl(item.value.logoUrl || '');
        setFaviconUrl(item.value.faviconUrl || '');
        setSupportEmail(item.value.supportEmail || '');
        setSupportTelegram(item.value.supportTelegram || '');
        setSupportPhone(item.value.supportPhone || '');
        setSocialInstagram(item.value.socialInstagram ?? 'https://instagram.com');
        setSocialTelegram(item.value.socialTelegram || item.value.supportTelegram || 'https://t.me');
        setSocialWhatsapp(item.value.socialWhatsapp || '');
        setSocialYoutube(item.value.socialYoutube || '');
        setSocialLinkedin(item.value.socialLinkedin || '');
      }
      if (item.key === 'seo_settings' && item.value) {
        const cleanText = (str) =>
          typeof str === 'string'
            ? str.replace(/سوئد\s*پرشیا|سوید\s*پرشیا|فارسی\s*نورد|فارسی‌نورد|SwedPersiska|Farsi\s*Nord|Faris\s*Nord/gi, 'لینک شو')
            : str;
        setSeoSettings(prev => {
          const next = { ...prev };
          Object.keys(item.value).forEach((cid) => {
            const incoming = item.value[cid];
            if (incoming && typeof incoming === 'object') {
              const base = prev[cid] || {};
              next[cid] = {
                ...base,
                ...incoming,
                title: cleanText(incoming.title) || base.title,
                description: cleanText(incoming.description) || base.description,
                keywords: cleanText(incoming.keywords) || base.keywords,
                heroHeading: cleanText(incoming.heroHeading) || base.heroHeading,
                heroSubheading: cleanText(incoming.heroSubheading) || base.heroSubheading,
                ogTitle: cleanText(incoming.ogTitle) || base.ogTitle,
                ogDescription: cleanText(incoming.ogDescription) || base.ogDescription,
              };
            }
          });
          return next;
        });
      }
      if (item.key === 'portal_countries' && Array.isArray(item.value) && item.value.length > 0) {
        const merged = mergePortalCountries(item.value);
        setCountriesList(merged);
        try {
          localStorage.setItem('swedpersiska_portal_countries', JSON.stringify(merged));
        } catch {}
      }
      if (item.key === 'stripe_settings' && item.value) {
        setStripeSettings(prev => ({ ...prev, ...item.value }));
      }
      if (item.key === 'turnstile_settings' && item.value) {
        setTurnstileSettings(prev => ({ ...prev, ...item.value }));
      }
      if (item.key === 'analytics_settings' && item.value) {
        setAnalyticsSettings(prev => ({ ...prev, ...item.value }));
      }
      if (item.key === 'ad_reports' && Array.isArray(item.value)) {
        setAdReports(item.value);
      }
      if (item.key === 'r2_settings' && item.value) {
        setR2Settings(prev => ({ ...prev, ...item.value }));
      }
      if (item.key === 'podcast_settings' && item.value) {
        setPodcastSettings(prev => ({
          ...prev,
          ...item.value,
          manualVideos: Array.isArray(item.value.manualVideos) ? item.value.manualVideos : [],
        }));
      }
      if (item.key === 'seller_deployments' && Array.isArray(item.value)) {
        setSellerDeployments(item.value);
      }
      if (item.key === 'cloudflare_deploy_settings' && item.value) {
        setCfDeploySettings(prev => ({
          ...prev,
          accountId: item.value.accountId || '',
          deployUrl: item.value.deployUrl || 'https://linksho-seller.vercel.app/api/cloudflare/deploy',
          hasToken: Boolean(item.value.hasToken || item.value.apiToken),
          apiToken: ''
        }));
      }
      if (item.key === 'portal_categories' && item.value && Array.isArray(item.value) && item.value.length > 0) {
        setCategoriesList(item.value);
        try {
          localStorage.setItem('swedpersiska_portal_categories', JSON.stringify(item.value));
        } catch {}
      }
      if (item.key === 'portal_cities' && item.value && typeof item.value === 'object' && !Array.isArray(item.value)) {
        setCitiesByCountry(prev => {
          const mergedCities = { ...prev, ...item.value };
          try {
            localStorage.setItem('swedpersiska_portal_cities', JSON.stringify(mergedCities));
          } catch {}
          return mergedCities;
        });
      }
    });
  };

  const fetchAdminData = async () => {
    setLoading(true);
    const isDefaultAdsView =
      (activePage || 1) === 1 &&
      !searchQuery.trim() &&
      countryFilter === 'all' &&
      categoryFilter === 'all' &&
      adStatusFilter === 'active' &&
      !vipOnlyFilter;

    try {
      // Try Secure Serverless Admin API first (single round-trip returns counts, settings, recent, and page 1)
      const apiRes = await adminApi.request('overview');
      if (apiRes && apiRes.ok) {
        setCounts(apiRes.counts);
        setCountryStats(apiRes.countryStats);
        setCategoryCounts(apiRes.categoryCounts);
        if (apiRes.monthBuckets) setMonthBuckets(apiRes.monthBuckets);
        setRecentActiveAds(apiRes.recentActiveAds || []);
        applySettingsItems(apiRes.settings);
        if (isDefaultAdsView && Array.isArray(apiRes.initialActiveAds)) {
          setActiveAds(apiRes.initialActiveAds);
          setActiveTotalCount(apiRes.counts?.active ?? apiRes.initialActiveAds.length);
          setActivePage(1);
        } else {
          await fetchActiveAds(activePage || 1, searchQuery, countryFilter, categoryFilter, adStatusFilter, vipOnlyFilter);
        }
        return;
      }

      // Fast 3-query parallel fallback (replaces 8 sequential/parallel queries)
      const [firstPageRes, metaRes, settingsRes] = await Promise.all([
        supabase
          .from('swedpersiska_ads')
          .select('*')
          .eq('status', 'active')
          .order('is_featured', { ascending: false })
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .range(0, PAGE_SIZE - 1),
        supabase.from('swedpersiska_ads').select('category, country, status, is_featured, views_count, created_at'),
        supabase.from('swedpersiska_settings').select('*')
      ]);

      // Compute all aggregates in a single memory pass
      const cStats = {
        se: { total: 0, active: 0, vip: 0, views: 0 },
        no: { total: 0, active: 0, vip: 0, views: 0 },
        dk: { total: 0, active: 0, vip: 0, views: 0 },
        fi: { total: 0, active: 0, vip: 0, views: 0 },
        de: { total: 0, active: 0, vip: 0, views: 0 },
        at: { total: 0, active: 0, vip: 0, views: 0 },
        nl: { total: 0, active: 0, vip: 0, views: 0 },
        fr: { total: 0, active: 0, vip: 0, views: 0 }
      };
      const catCounts = {};
      const mBuckets = {};
      let tot = 0;
      let act = 0;
      let pend = 0;
      let vip = 0;
      let totalV = 0;

      (metaRes.data || []).forEach(row => {
        tot++;
        const c = row.country || 'se';
        if (!cStats[c]) cStats[c] = { total: 0, active: 0, vip: 0, views: 0 };
        cStats[c].total++;
        if (row.status === 'active') {
          act++;
          cStats[c].active++;
        } else if (row.status === 'pending') {
          pend++;
        }
        if (row.is_featured) {
          vip++;
          cStats[c].vip++;
        }
        cStats[c].views += (row.views_count || 1);
        totalV += (row.views_count || 1);

        if (row.category) {
          catCounts[row.category] = (catCounts[row.category] || 0) + 1;
        }
        if (row.created_at) {
          const ym = String(row.created_at).slice(0, 7);
          if (/^\d{4}-\d{2}$/.test(ym)) {
            if (!mBuckets[ym]) mBuckets[ym] = { total: 0, vip: 0 };
            mBuckets[ym].total++;
            if (row.is_featured) mBuckets[ym].vip++;
          }
        }
      });

      const firstPageAds = firstPageRes.data || [];

      setCounts({
        total: tot,
        active: act,
        pending: pend,
        vip: vip,
        totalViews: totalV
      });
      setCountryStats(cStats);
      setCategoryCounts(catCounts);
      setMonthBuckets(mBuckets);
      setRecentActiveAds(firstPageAds.slice(0, 5));
      applySettingsItems(settingsRes.data);

      if (isDefaultAdsView) {
        setActiveAds(firstPageAds);
        setActiveTotalCount(act);
        setActivePage(1);
      } else {
        await fetchActiveAds(activePage || 1, searchQuery, countryFilter, categoryFilter, adStatusFilter, vipOnlyFilter);
      }
    } catch (err) {
      console.error('Error fetching admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Debounced search helper (250ms) so typing never fires per-keystroke DB queries
  const handleDebouncedSearch = (val, switchTab = false) => {
    setSearchQuery(val);
    if (switchTab && activeTab !== 'ads') {
      handleTabChange('ads');
    }
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      fetchActiveAds(1, val, countryFilter, categoryFilter, adStatusFilter, vipOnlyFilter);
    }, 250);
  };

  // 2. Fetch Ads with Server-side Pagination (10 records limit, deterministic ordering)
  const fetchActiveAds = async (page = 1, search = searchQuery, country = countryFilter, cat = categoryFilter, status = adStatusFilter, vipOnly = vipOnlyFilter) => {
    const safePage = Math.max(1, Number(page) || 1);
    setActivePage(safePage);
    setActiveLoading(true);
    try {
      const apiRes = await adminApi.request('active_ads', { page: safePage, search, country, category: cat, status, vipOnly });
      if (apiRes && apiRes.ok) {
        setActiveAds(apiRes.ads || []);
        setActiveTotalCount(apiRes.count ?? 0);
        setActivePage(safePage);
        return;
      }

      const from = (safePage - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let q = supabase
        .from('swedpersiska_ads')
        .select('*', { count: 'exact' });

      if (status && status !== 'all') {
        q = q.eq('status', status);
      }
      if (vipOnly) {
        q = q.eq('is_featured', true);
      }

      if (country && country !== 'all') {
        q = q.eq('country', country);
      }
      if (cat && cat !== 'all') {
        q = q.eq('category', cat);
      }
      if (search && search.trim()) {
        const sanitized = search.trim().replace(/[,()]/g, ' ').trim();
        if (sanitized) {
          const term = `%${sanitized}%`;
          q = q.or(`title.ilike.${term},description.ilike.${term},city.ilike.${term},reference_number.ilike.${term},contact_name.ilike.${term}`);
        }
      }

      q = q
        .order('is_featured', { ascending: false })
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(from, to);

      const { data, count, error } = await q;
      if (error) throw error;

      setActiveAds(data || []);
      setActiveTotalCount(count ?? 0);
      setActivePage(safePage);
    } catch (err) {
      console.error('Error fetching active ads:', err);
      triggerToast('خطا در بارگذاری صفحه آگهی‌ها: ' + (err.message || ''), 'error');
    } finally {
      setActiveLoading(false);
    }
  };

  // Persist Categories to Supabase & localStorage
  const persistCategories = async (updated) => {
    setCategoriesList(updated);
    try {
      localStorage.setItem('swedpersiska_portal_categories', JSON.stringify(updated));
    } catch {}
    try {
      const apiRes = await adminApi.request('save_settings', { key: 'portal_categories', value: updated });
      if (!apiRes || !apiRes.ok) {
        const { error } = await supabase
          .from('swedpersiska_settings')
          .upsert({
            key: 'portal_categories',
            value: updated,
            updated_at: new Date().toISOString()
          });
        if (error) throw error;
      }
    } catch (err) {
      console.error('Error saving categories to Supabase:', err);
      triggerToast('خطا در ذخیره دسته‌بندی‌ها در دیتابیس', 'error');
    }
  };

  // Persist Cities to Supabase & localStorage
  const persistCities = async (updated) => {
    setCitiesByCountry(updated);
    try {
      localStorage.setItem('swedpersiska_portal_cities', JSON.stringify(updated));
    } catch {}
    try {
      const apiRes = await adminApi.request('save_settings', { key: 'portal_cities', value: updated });
      if (!apiRes || !apiRes.ok) {
        const { error } = await supabase
          .from('swedpersiska_settings')
          .upsert({
            key: 'portal_cities',
            value: updated,
            updated_at: new Date().toISOString()
          });
        if (error) throw error;
      }
    } catch (err) {
      console.error('Error saving cities to Supabase:', err);
      triggerToast('خطا در ذخیره شهرها در دیتابیس', 'error');
    }
  };

  // Persist Countries & Country Hero Background Photos to Supabase & localStorage
  const persistCountries = async (updated) => {
    setCountriesList(updated);
    try {
      localStorage.setItem('swedpersiska_portal_countries', JSON.stringify(updated));
    } catch {}
    try {
      const apiRes = await adminApi.request('save_settings', { key: 'portal_countries', value: updated });
      if (!apiRes || !apiRes.ok) {
        const { error } = await supabase
          .from('swedpersiska_settings')
          .upsert({
            key: 'portal_countries',
            value: updated,
            updated_at: new Date().toISOString()
          });
        if (error) throw error;
      }
    } catch (err) {
      console.error('Error saving countries to Supabase:', err);
      triggerToast('خطا در ذخیره کشورها در دیتابیس', 'error');
    }
  };

  const handleCountryHeroUpload = async (file, countryId) => {
    if (!file) return;
    if (file.size > 5242880) {
      alert('حجم تصویر نباید بیشتر از ۵ مگابایت باشد.');
      return;
    }
    setUploadingBrandKey(`country_${countryId}`);
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const base64Part = dataUrl.includes(',') ? dataUrl.split(',')[1] : '';
      if (!base64Part) throw new Error('خطا در خواندن فایل تصویر.');

      const res = await adminApi.request('upload_branding_file', {
        kind: `country_${countryId}`,
        contentType: file.type || 'image/jpeg',
        fileBase64: base64Part,
      });
      if (!res || !res.ok || !res.publicUrl) {
        throw new Error(res?.error || 'خطا در آپلود تصویر (بررسی کنید Cloudflare R2 فعال باشد).');
      }
      const nextCountries = countriesList.map(c =>
        c.id === countryId ? { ...c, heroImage: res.publicUrl } : c
      );
      await persistCountries(nextCountries);
      triggerToast('تصویر پس‌زمینه هیرو آپلود و ذخیره شد!');
    } catch (err) {
      alert(err.message || 'خطا در آپلود تصویر پس‌زمینه');
    } finally {
      setUploadingBrandKey(null);
    }
  };

  const handleAddNewCountry = async () => {
    const cleanId = String(newCountryForm.id || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const cleanName = String(newCountryForm.nameFa || '').trim();
    const cleanCurrency = String(newCountryForm.currency || '€').trim() || '€';
    const cleanHero = String(newCountryForm.heroImage || '').trim() || '/images/cities/stockholm.jpg';

    if (!cleanId || cleanId.length < 2) {
      alert('لطفاً کد کوتاه انگلیسی کشور (مثلاً uk یا ch یا us) را وارد کنید.');
      return;
    }
    if (!cleanName) {
      alert('لطفاً نام فارسی کشور را وارد کنید.');
      return;
    }
    if (countriesList.some(c => c.id === cleanId)) {
      alert('این کد کشور قبلاً ثبت شده است.');
      return;
    }

    const parsedCities = (newCountryForm.citiesText || '')
      .split(/[،,\n]/)
      .map(s => s.trim())
      .filter(Boolean)
      .map(part => {
        if (part.includes(':')) {
          const [idPart, faPart] = part.split(':').map(x => x.trim());
          return { id: idPart || faPart, fa: faPart || idPart, enabled: true, isSystem: false };
        }
        return { id: part, fa: part, enabled: true, isSystem: false };
      });

    const newCountryObj = {
      id: cleanId,
      nameFa: cleanName,
      nameNative: cleanName,
      flag: '🌍',
      currency: cleanCurrency,
      currencyName: cleanCurrency,
      heroImage: cleanHero,
      enabled: true,
      isSystem: false,
      cities: [
        { id: 'all', fa: 'همه شهرها' },
        ...parsedCities.map(ct => ({ id: ct.id, fa: ct.fa }))
      ]
    };

    const nextCountries = [...countriesList, newCountryObj];
    await persistCountries(nextCountries);

    if (parsedCities.length > 0) {
      const nextCities = {
        ...citiesByCountry,
        [cleanId]: parsedCities
      };
      await persistCities(nextCities);
    }

    setSeoActiveCountry(cleanId);
    setNewCountryOpen(false);
    setNewCountryForm({ id: '', nameFa: '', currency: '€', heroImage: '', citiesText: '' });
    triggerToast(`کشور «${cleanName}» با موفقیت اضافه شد!`);
  };

  const handleOpenAddCity = () => {
    playFeedback('click');
    setCityModal({
      isOpen: true,
      mode: 'add',
      countryId: cityCountryFilter,
      originalId: '',
      id: '',
      fa: '',
      enabled: true,
      errorMsg: ''
    });
  };

  const handleOpenEditCity = (city) => {
    playFeedback('click');
    setCityModal({
      isOpen: true,
      mode: 'edit',
      countryId: cityCountryFilter,
      originalId: city.id,
      id: city.id,
      fa: city.fa,
      enabled: city.enabled !== false,
      errorMsg: ''
    });
  };

  const handleSaveCityModal = async (e) => {
    e.preventDefault();
    const trimmedFa = cityModal.fa.trim();
    const trimmedId = cityModal.id.trim();
    if (!trimmedFa) {
      setCityModal(prev => ({ ...prev, errorMsg: 'لطفاً نام فارسی شهر را وارد نمایید.' }));
      return;
    }
    if (!trimmedId) {
      setCityModal(prev => ({ ...prev, errorMsg: 'لطفاً نام لاتین / شناسه شهر را وارد نمایید.' }));
      return;
    }

    const countryCities = citiesByCountry[cityModal.countryId] || [];
    if (cityModal.mode === 'add') {
      if (countryCities.some(c => c.id.toLowerCase() === trimmedId.toLowerCase())) {
        setCityModal(prev => ({ ...prev, errorMsg: 'این شهر قبلاً برای این کشور ثبت شده است.' }));
        return;
      }
      const nextCities = [...countryCities, { id: trimmedId, fa: trimmedFa, enabled: cityModal.enabled, isSystem: false }];
      await persistCities({ ...citiesByCountry, [cityModal.countryId]: nextCities });
      triggerToast(`شهر «${trimmedFa}» با موفقیت اضافه شد.`);
    } else {
      const nextCities = countryCities.map(c =>
        c.id === cityModal.originalId ? { ...c, id: trimmedId, fa: trimmedFa, enabled: cityModal.enabled } : c
      );
      await persistCities({ ...citiesByCountry, [cityModal.countryId]: nextCities });
      triggerToast(`شهر «${trimmedFa}» بروزرسانی شد.`);
    }
    playFeedback('success');
    setCityModal(prev => ({ ...prev, isOpen: false, errorMsg: '' }));
  };

  const handleToggleCityStatus = async (cityId) => {
    playFeedback('status');
    const countryCities = citiesByCountry[cityCountryFilter] || [];
    const target = countryCities.find(c => c.id === cityId);
    const nextEnabled = target ? target.enabled === false : true;
    const nextCities = countryCities.map(c => c.id === cityId ? { ...c, enabled: nextEnabled } : c);
    await persistCities({ ...citiesByCountry, [cityCountryFilter]: nextCities });
    if (target) {
      triggerToast(nextEnabled ? `شهر «${target.fa}» فعال شد.` : `شهر «${target.fa}» غیرفعال شد.`);
    }
  };

  const handleConfirmDeleteCity = async () => {
    if (!cityToDelete) return;
    playFeedback('delete');
    const countryCities = citiesByCountry[cityCountryFilter] || [];
    const nextCities = countryCities.filter(c => c.id !== cityToDelete.id);
    await persistCities({ ...citiesByCountry, [cityCountryFilter]: nextCities });
    triggerToast(`شهر «${cityToDelete.fa}» حذف شد.`);
    setCityToDelete(null);
  };

  // Categories Action Handlers
  const handleOpenAddCategory = () => {
    playFeedback('click');
    setCategoryModal({
      isOpen: true,
      mode: 'add',
      id: '',
      fa: '',
      icon: 'Tag',
      enabled: true,
      isSystem: false,
      errorMsg: ''
    });
  };

  const handleOpenEditCategory = (cat) => {
    playFeedback('click');
    setCategoryModal({
      isOpen: true,
      mode: 'edit',
      id: cat.id,
      fa: cat.fa,
      icon: cat.icon || 'Tag',
      enabled: cat.enabled !== false,
      isSystem: !!cat.isSystem,
      errorMsg: ''
    });
  };

  const handleSaveCategoryModal = async (e) => {
    if (e) e.preventDefault();
    const trimmedFa = categoryModal.fa.trim();
    const rawId = categoryModal.id.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');

    if (!trimmedFa) {
      setCategoryModal(prev => ({ ...prev, errorMsg: 'لطفاً عنوان دسته‌بندی را وارد نمایید.' }));
      return;
    }
    if (!rawId) {
      setCategoryModal(prev => ({ ...prev, errorMsg: 'لطفاً شناسه یکتای دسته‌بندی را وارد نمایید.' }));
      return;
    }

    if (categoryModal.mode === 'add') {
      const exists = categoriesList.some(c => c.id.toLowerCase() === rawId);
      if (exists) {
        setCategoryModal(prev => ({ ...prev, errorMsg: 'این شناسه قبلاً برای دسته‌بندی دیگری استفاده شده است.' }));
        return;
      }

      const newCategory = {
        id: rawId,
        fa: trimmedFa,
        icon: categoryModal.icon || 'Tag',
        enabled: categoryModal.enabled,
        isSystem: false,
        order: categoriesList.length + 1
      };

      const updated = [...categoriesList, newCategory];
      await persistCategories(updated);
      playFeedback('status');
      triggerToast(`دسته‌بندی «${trimmedFa}» اضافه شد.`);
      setCategoryModal({ isOpen: false, mode: 'add', id: '', fa: '', icon: 'Tag', enabled: true, isSystem: false, errorMsg: '' });
    } else {
      // Edit mode
      const updated = categoriesList.map(c => {
        if (c.id === categoryModal.id) {
          return {
            ...c,
            fa: trimmedFa,
            icon: categoryModal.icon || c.icon || 'Tag',
            enabled: categoryModal.enabled
          };
        }
        return c;
      });

      await persistCategories(updated);
      playFeedback('status');
      triggerToast(`دسته‌بندی «${trimmedFa}» به‌روزرسانی شد.`);
      setCategoryModal({ isOpen: false, mode: 'add', id: '', fa: '', icon: 'Tag', enabled: true, isSystem: false, errorMsg: '' });
    }
  };

  const handleToggleCategoryStatus = async (catId) => {
    playFeedback('click');
    const target = categoriesList.find(c => c.id === catId);
    const nextStatus = target ? !target.enabled : true;
    const updated = categoriesList.map(c => {
      if (c.id === catId) {
        return { ...c, enabled: nextStatus };
      }
      return c;
    });
    await persistCategories(updated);
    triggerToast(nextStatus ? 'دسته‌بندی فعال شد' : 'دسته‌بندی غیرفعال شد');
  };

  const handleDeleteCategoryConfirm = async () => {
    if (!categoryToDelete) return;
    playFeedback('delete');
    const updated = categoriesList.filter(c => c.id !== categoryToDelete.id);
    await persistCategories(updated);
    triggerToast(`دسته‌بندی «${categoryToDelete.fa}» حذف شد.`);
    setCategoryToDelete(null);
  };

  const handleViewCategoryAds = (catId) => {
    playFeedback('select');
    setCategoryFilter(catId);
    handleTabChange('ads');
    fetchActiveAds(1, searchQuery, countryFilter, catId);
    triggerToast(`فیلتر دسته‌بندی اعمال شد.`);
  };

  // Login verification via Secure Serverless Admin API
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');

    // Check Cloudflare Anti-Bot if enabled
    if (turnstileSettings.enabled !== false && turnstileSettings.protectAdminLogin !== false) {
      if (!adminTurnstileToken) {
        setLoginError('لطفاً تاییدیه امنیتی ضدبات را تکمیل کنید.');
        return;
      }
    }

    setLoginSubmitting(true);
    try {
      await adminApi.login(adminEmailInput, adminPassInput);
      setIsAuthenticated(true);
      fetchAdminData();
    } catch (err) {
      setLoginError(err.message || 'ایمیل یا رمز عبور اشتباه است.');
    } finally {
      setLoginSubmitting(false);
    }
  };

  // Pre-fetch turnstile & branding settings on login screen so Turnstile toggle in DB is respected
  useEffect(() => {
    if (isAuthenticated) return;
    supabase
      .from('swedpersiska_settings')
      .select('key, value')
      .in('key', ['turnstile_settings', 'site_branding'])
      .then(({ data }) => {
        if (Array.isArray(data)) {
          applySettingsItems(data);
        }
      })
      .catch(() => {});
  }, [isAuthenticated]);

  // Logout handler
  const handleLogout = () => {
    setIsAuthenticated(false);
    adminApi.setToken('');
    try {
      localStorage.removeItem('swedpersiska_admin_tab');
      const url = new URL(window.location.href);
      url.searchParams.delete('admin');
      url.searchParams.delete('tab');
      window.history.replaceState({}, '', url.toString());
    } catch {}
    onClose();
  };

  // Auto-fetch data on mount if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchAdminData();
    }
  }, [isAuthenticated]);

  // Update country of an ad (Optimistic 0ms UI update)
  const updateAdCountry = async (adId, newCountry) => {
    playFeedback('click');
    const prevActive = activeAds;
    setActiveAds(prev => prev.map(a => a.id === adId ? { ...a, country: newCountry } : a));
    setRecentActiveAds(prev => prev.map(a => a.id === adId ? { ...a, country: newCountry } : a));
    setSelectedAdForModal(prev => prev && prev.id === adId ? { ...prev, country: newCountry } : prev);
    try {
      const apiRes = await adminApi.request('update_country', { id: adId, country: newCountry });
      if (!apiRes || !apiRes.ok) {
        const { error } = await supabase
          .from('swedpersiska_ads')
          .update({ country: newCountry })
          .eq('id', adId);
        if (error) throw error;
      }
      const countryObj = COUNTRIES.find(c => c.id === newCountry) || COUNTRIES[0];
      triggerToast(`کشور آگهی به ${countryObj.nameFa} تغییر یافت.`);
      if (onRefreshAds) onRefreshAds();
    } catch (err) {
      setActiveAds(prevActive);
      triggerToast('خطا در تغییر کشور آگهی: ' + err.message, 'error');
    }
  };

  // Toggle Featured / VIP (Optimistic 0ms UI update + country VIP stats sync)
  const toggleFeatured = async (ad) => {
    playFeedback('vip');
    const nextVal = !ad.is_featured;
    const adCountry = ad.country || 'se';
    setActiveAds(prev => prev.map(a => a.id === ad.id ? { ...a, is_featured: nextVal } : a));
    setRecentActiveAds(prev => prev.map(a => a.id === ad.id ? { ...a, is_featured: nextVal } : a));
    setSelectedAdForModal(prev => prev && prev.id === ad.id ? { ...prev, is_featured: nextVal } : prev);
    setCounts(prev => ({
      ...prev,
      vip: nextVal ? prev.vip + 1 : Math.max(0, prev.vip - 1)
    }));
    setCountryStats(prev => {
      const cur = prev[adCountry] || { total: 0, active: 0, vip: 0, views: 0 };
      return {
        ...prev,
        [adCountry]: { ...cur, vip: nextVal ? cur.vip + 1 : Math.max(0, cur.vip - 1) }
      };
    });
    try {
      const apiRes = await adminApi.request('toggle_featured', { id: ad.id, is_featured: nextVal });
      if (!apiRes || !apiRes.ok) {
        const { error } = await supabase
          .from('swedpersiska_ads')
          .update({ is_featured: nextVal })
          .eq('id', ad.id);
        if (error) throw error;
      }
      triggerToast(nextVal ? 'آگهی به وضعیت ویژه (VIP) ارتقا یافت.' : 'نشان ویژه حذف شد.');
      if (onRefreshAds) onRefreshAds();
    } catch (err) {
      triggerToast('خطا در تغییر وضعیت ویژه: ' + err.message, 'error');
    }
  };

  const openAdsPreset = (statusVal, vipOnlyVal = false) => {
    setAdStatusFilter(statusVal);
    setVipOnlyFilter(vipOnlyVal);
    handleTabChange('ads');
    fetchActiveAds(1, searchQuery, countryFilter, categoryFilter, statusVal, vipOnlyVal);
  };

  const dismissReportAdmin = async (reportId) => {
    try {
      const apiRes = await adminApi.request('dismiss_report', { reportId });
      if (!apiRes || !apiRes.ok) {
        const nextList = adReports.filter(r => String(r.id) !== String(reportId));
        await supabase.from('swedpersiska_settings').upsert({
          key: 'ad_reports',
          value: nextList,
          updated_at: new Date().toISOString()
        });
      }
      setAdReports(prev => prev.filter(r => String(r.id) !== String(reportId)));
      triggerToast('گزارش بسته شد.');
    } catch (err) {
      triggerToast('خطا در بستن گزارش: ' + err.message, 'error');
    }
  };

  // Approve Pending Ad (Publish to site)
  const approveAdAdmin = async (adId) => {
    playFeedback('vip');
    try {
      const apiRes = await adminApi.request('update_status', { id: adId, status: 'active' });
      if (!apiRes || !apiRes.ok) {
        const { error } = await supabase
          .from('swedpersiska_ads')
          .update({ status: 'active', updated_at: new Date().toISOString() })
          .eq('id', adId);
        if (error) throw error;
      }
      setActiveAds(prev =>
        adStatusFilter === 'pending'
          ? prev.filter(a => a.id !== adId)
          : prev.map(a => a.id === adId ? { ...a, status: 'active' } : a)
      );
      setCounts(prev => ({
        ...prev,
        active: prev.active + 1,
        pending: Math.max(0, (prev.pending || 0) - 1),
      }));
      setSelectedAdForModal(prev => prev && prev.id === adId ? { ...prev, status: 'active' } : prev);
      triggerToast('آگهی تایید و در سایت منتشر شد.');
      if (onRefreshAds) onRefreshAds();
    } catch (err) {
      triggerToast('خطا در تایید آگهی: ' + err.message, 'error');
    }
  };

  // Permanent Delete
  const deleteAdAdmin = async (id) => {
    if (!window.confirm('آیا از حذف همیشگی این آگهی اطمینان دارید؟ این عملیات غیرقابل بازگشت است.')) {
      return;
    }
    playFeedback('delete');
    try {
      const apiRes = await adminApi.request('delete_ad', { id });
      if (!apiRes || !apiRes.ok) {
        const { error } = await supabase
          .from('swedpersiska_ads')
          .delete()
          .eq('id', id);
        if (error) throw error;
      }
      setActiveAds(prev => prev.filter(a => a.id !== id));
      setRecentActiveAds(prev => prev.filter(a => a.id !== id));
      setCounts(prev => ({
        ...prev,
        total: Math.max(0, prev.total - 1),
        active: Math.max(0, prev.active - 1)
      }));
      if (selectedAdForModal && selectedAdForModal.id === id) {
        setSelectedAdForModal(null);
      }
      triggerToast('آگهی برای همیشه حذف شد.');
      if (onRefreshAds) onRefreshAds();
    } catch (err) {
      triggerToast('خطا در حذف آگهی: ' + err.message, 'error');
    }
  };

  // Upload Logo or Favicon via Admin Server API to Cloudflare R2 (bypasses browser CORS)
  const handleBrandingFileUpload = async (file, kind) => {
    if (!file) return;
    if (file.size > 1048576) {
      triggerToast('حداکثر حجم مجاز برای لوگو یا آیکون ۱ مگابایت است.', 'error');
      return;
    }
    setUploadingBrandKey(kind);
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const base64Part = dataUrl.includes(',') ? dataUrl.split(',')[1] : '';
      if (!base64Part) throw new Error('خطا در خواندن فایل تصویر.');

      const res = await adminApi.request('upload_branding_file', {
        kind,
        contentType: file.type || 'image/png',
        fileBase64: base64Part,
      });
      if (!res || !res.ok || !res.publicUrl) {
        throw new Error(res?.error || 'خطا در آپلود فایل (بررسی کنید Cloudflare R2 فعال باشد).');
      }
      if (kind === 'favicon') {
        setFaviconUrl(res.publicUrl);
      } else {
        setLogoUrl(res.publicUrl);
      }
      triggerToast('فایل با موفقیت آپلود شد! برای ثبت نهایی «ذخیره مشخصات» را بزنید.');
    } catch (err) {
      triggerToast(err.message || 'خطا در آپلود تصویر', 'error');
    } finally {
      setUploadingBrandKey(null);
    }
  };

  // Save Site Branding Settings
  const saveBrandingSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const payload = {
        siteName: siteName.trim(),
        siteSlogan: siteSlogan.trim(),
        logoUrl: logoUrl.trim(),
        faviconUrl: faviconUrl.trim(),
        supportEmail: supportEmail.trim(),
        supportTelegram: supportTelegram.trim(),
        supportPhone: supportPhone.trim(),
        socialInstagram: socialInstagram.trim(),
        socialTelegram: socialTelegram.trim(),
        socialWhatsapp: socialWhatsapp.trim(),
        socialYoutube: socialYoutube.trim(),
        socialLinkedin: socialLinkedin.trim()
      };

      const apiRes = await adminApi.request('save_settings', { key: 'site_branding', value: payload });
      if (!apiRes || !apiRes.ok) {
        const { error } = await supabase
          .from('swedpersiska_settings')
          .upsert({
            key: 'site_branding',
            value: payload,
            updated_at: new Date().toISOString()
          });
        if (error) throw error;
      }
      const msg = 'مشخصات برند و لینک‌های فوتر با موفقیت ذخیره شد!';
      setSaveSuccessMsg(msg);
      triggerToast(msg, 'success');
      setTimeout(() => setSaveSuccessMsg(''), 3500);
    } catch (err) {
      triggerToast('خطا در ذخیره تنظیمات برند: ' + err.message, 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  // Save SEO Settings for Active Country
  const saveSeoSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await persistCountries(countriesList);
      const apiRes = await adminApi.request('save_settings', { key: 'seo_settings', value: seoSettings });
      if (!apiRes || !apiRes.ok) {
        const { error } = await supabase
          .from('swedpersiska_settings')
          .upsert({
            key: 'seo_settings',
            value: seoSettings,
            updated_at: new Date().toISOString()
          });
        if (error) throw error;
      }
      const countryObj = countriesList.find(c => c.id === seoActiveCountry) || countriesList[0];
      const msg = `تنظیمات سئو و پس‌زمینه کشور ${countryObj.nameFa} با موفقیت ذخیره شد!`;
      setSaveSuccessMsg(msg);
      triggerToast(msg, 'success');
      setTimeout(() => setSaveSuccessMsg(''), 3500);
    } catch (err) {
      triggerToast('خطا در ذخیره سئو: ' + err.message, 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  const saveAnalyticsSettings = async (e) => {
    e.preventDefault();
    const cleanId = (analyticsSettings.measurementId || '').trim().toUpperCase();
    if (analyticsSettings.enabled && !/^G-[A-Z0-9]{4,}$/.test(cleanId)) {
      triggerToast('لطفاً شناسه معتبر گوگل آنالیتیکس وارد کنید (مثال: G-XXXXXXXXXX).', 'error');
      return;
    }
    const payload = { enabled: Boolean(analyticsSettings.enabled), measurementId: cleanId };
    setAnalyticsSettings(payload);
    setSavingSettings(true);
    try {
      const apiRes = await adminApi.request('save_settings', { key: 'analytics_settings', value: payload });
      if (!apiRes || !apiRes.ok) {
        const { error } = await supabase
          .from('swedpersiska_settings')
          .upsert({
            key: 'analytics_settings',
            value: payload,
            updated_at: new Date().toISOString()
          });
        if (error) throw error;
      }
      const msg = 'تنظیمات گوگل آنالیتیکس با موفقیت ذخیره شد!';
      setSaveSuccessMsg(msg);
      triggerToast(msg, 'success');
      setTimeout(() => setSaveSuccessMsg(''), 3500);
    } catch (err) {
      triggerToast('خطا در ذخیره تنظیمات آنالیتیکس: ' + err.message, 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  const saveR2Settings = async (e) => {
    e.preventDefault();
    if (r2Settings.enabled && (!r2Settings.accountId.trim() || !r2Settings.bucketName.trim() || !r2Settings.publicUrl.trim())) {
      triggerToast('لطفاً شناسه حساب، نام سطل ذخیره‌سازی و آدرس عمومی دامنه تصاویر را وارد کنید.', 'error');
      return;
    }
    setSavingSettings(true);
    try {
      const payload = {
        enabled: Boolean(r2Settings.enabled),
        accountId: r2Settings.accountId.trim(),
        bucketName: r2Settings.bucketName.trim(),
        publicUrl: r2Settings.publicUrl.trim().replace(/\/+$/, ''),
        accessKeyId: r2Settings.accessKeyId.trim(),
        secretAccessKey: r2Settings.secretAccessKey.trim()
      };
      const apiRes = await adminApi.request('save_settings', { key: 'r2_settings', value: payload });
      if (!apiRes || !apiRes.ok) {
        const { error } = await supabase
          .from('swedpersiska_settings')
          .upsert({
            key: 'r2_settings',
            value: payload,
            updated_at: new Date().toISOString()
          });
        if (error) throw error;
      }
      setR2Settings(prev => ({
        ...prev,
        hasCredentials: prev.hasCredentials || Boolean(payload.accessKeyId && payload.secretAccessKey),
        accessKeyId: '',
        secretAccessKey: ''
      }));
      const msg = 'تنظیمات فضای ابری کلودفلر R2 با موفقیت ذخیره شد!';
      setSaveSuccessMsg(msg);
      triggerToast(msg, 'success');
      setTimeout(() => setSaveSuccessMsg(''), 3500);
    } catch (err) {
      triggerToast('خطا در ذخیره تنظیمات فضای ابری: ' + err.message, 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  // Save Stripe & Monetization Settings (never persists secretKey/webhookSecret to public settings table)
  const saveStripeSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const publicStripePayload = {
        enabled: stripeSettings.enabled,
        mode: stripeSettings.mode,
        publishableKey: (stripeSettings.publishableKey || '').trim(),
        vipPrice: Number(stripeSettings.vipPrice) || 99,
        currency: stripeSettings.currency || 'SEK',
        vipDurationDays: Number(stripeSettings.vipDurationDays) || 30,
        vipBadgeText: stripeSettings.vipBadgeText || 'ویژه (VIP)'
      };
      const apiRes = await adminApi.request('save_settings', { key: 'stripe_settings', value: publicStripePayload });
      if (!apiRes || !apiRes.ok) {
        const { error } = await supabase
          .from('swedpersiska_settings')
          .upsert({
            key: 'stripe_settings',
            value: publicStripePayload,
            updated_at: new Date().toISOString()
          });
        if (error) throw error;
      }
      const msg = 'تنظیمات درگاه پرداخت و تعرفه ویژه (VIP) با موفقیت ذخیره شد!';
      setSaveSuccessMsg(msg);
      triggerToast(msg, 'success');
      setTimeout(() => setSaveSuccessMsg(''), 3500);
    } catch (err) {
      triggerToast('خطا در ذخیره تنظیمات درگاه پرداخت: ' + err.message, 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  // Extract YouTube Video ID or Channel ID
  const extractYoutubeVideoId = (rawUrl) => {
    if (!rawUrl) return '';
    const trimmed = String(rawUrl).trim();
    if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
    const match = trimmed.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : '';
  };

  const handleAddManualPodcastVideo = () => {
    const videoId = extractYoutubeVideoId(newPodcastVideoUrl);
    if (!videoId) {
      triggerToast('لینک ویدیوی یوتیوب معتبر نیست (مثال: https://youtu.be/... یا youtube.com/watch?v=...)', 'error');
      return;
    }
    const existing = Array.isArray(podcastSettings.manualVideos) ? podcastSettings.manualVideos : [];
    if (existing.some(v => v.videoId === videoId)) {
      triggerToast('این ویدیو قبلاً در لیست ثبت شده است.', 'error');
      return;
    }
    const nextItem = {
      videoId,
      title: (newPodcastVideoTitle || '').trim() || `قسمت پادکست (${videoId})`,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      addedAt: new Date().toISOString()
    };
    setPodcastSettings(prev => ({
      ...prev,
      manualVideos: [nextItem, ...(prev.manualVideos || [])]
    }));
    setNewPodcastVideoUrl('');
    setNewPodcastVideoTitle('');
  };

  // Save News Podcast & YouTube Feed Settings
  const savePodcastSettings = async (e) => {
    if (e) e.preventDefault();
    setSavingSettings(true);
    try {
      const chUrl = (podcastSettings.youtubeChannelUrl || '').trim();
      const chMatch = chUrl.match(/youtube\.com\/channel\/(UC[a-zA-Z0-9_-]+)/);
      const resolvedChannelId = (podcastSettings.youtubeChannelId || '').trim() || (chMatch ? chMatch[1] : '');

      const payload = {
        enabled: podcastSettings.enabled !== false,
        title: (podcastSettings.title || '').trim() || 'پادکست خبری لینک شو',
        subtitle: (podcastSettings.subtitle || '').trim() || 'تازه‌ترین گزارش‌ها و پادکست‌های خبری فارسی‌زبانان اروپا',
        youtubeChannelUrl: chUrl,
        youtubeChannelId: resolvedChannelId,
        manualVideos: Array.isArray(podcastSettings.manualVideos) ? podcastSettings.manualVideos : []
      };

      const apiRes = await adminApi.request('save_settings', { key: 'podcast_settings', value: payload });
      if (!apiRes || !apiRes.ok) {
        const { error } = await supabase
          .from('swedpersiska_settings')
          .upsert({
            key: 'podcast_settings',
            value: payload,
            updated_at: new Date().toISOString()
          });
        if (error) throw error;
      }

      setPodcastSettings(payload);
      const msg = 'تنظیمات پادکست خبری و لینک یوتیوب با موفقیت ذخیره شد!';
      setSaveSuccessMsg(msg);
      triggerToast(msg, 'success');
      setTimeout(() => setSaveSuccessMsg(''), 3500);
    } catch (err) {
      triggerToast('خطا در ذخیره تنظیمات پادکست خبری: ' + err.message, 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  // Save Admin Cloudflare Token & Account ID for 1-Click Seller Website Builder
  const saveCloudflareDeploySettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const payload = {
        accountId: (cfDeploySettings.accountId || '').trim(),
        deployUrl: (cfDeploySettings.deployUrl || 'https://linksho-seller.vercel.app/api/cloudflare/deploy').trim(),
        apiToken: (cfDeploySettings.apiToken || '').trim(),
      };
      const apiRes = await adminApi.request('save_settings', { key: 'cloudflare_deploy_settings', value: payload });
      if (!apiRes || !apiRes.ok) {
        const { data: existingCf } = await supabase
          .from('swedpersiska_settings')
          .select('value')
          .eq('key', 'cloudflare_deploy_settings')
          .maybeSingle();
        const prevCf = (existingCf && existingCf.value) || {};
        const { error } = await supabase.from('swedpersiska_settings').upsert({
          key: 'cloudflare_deploy_settings',
          value: {
            accountId: payload.accountId,
            deployUrl: payload.deployUrl,
            apiToken: payload.apiToken || prevCf.apiToken || '',
          },
          updated_at: new Date().toISOString(),
        });
        if (error) throw error;
      }
      setCfDeploySettings(prev => ({
        ...prev,
        hasToken: prev.hasToken || Boolean(payload.apiToken),
        apiToken: '',
      }));
      const msg = 'توکن کلودفلر برای ساخت وب‌سایت مشتریان با موفقیت ذخیره شد!';
      setSaveSuccessMsg(msg);
      triggerToast(msg, 'success');
      setTimeout(() => setSaveSuccessMsg(''), 3500);
    } catch (err) {
      triggerToast('خطا در ذخیره توکن کلودفلر: ' + err.message, 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  // Test Cloudflare Connection (verifies API Token, Account ID & workers.dev subdomain)
  const handleTestCloudflareConnection = async () => {
    setTestingCf(true);
    setCfTestStatus(null);
    try {
      const apiRes = await adminApi.request('test_cloudflare_connection', {
        apiToken: (cfDeploySettings.apiToken || '').trim(),
      });
      if (apiRes && apiRes.ok) {
        setCfTestStatus(apiRes);
        if (apiRes.accountId && !cfDeploySettings.accountId) {
          setCfDeploySettings(prev => ({ ...prev, accountId: apiRes.accountId }));
        }
        triggerToast(`اتصال کلودفلر تایید شد (${apiRes.accountName})`, 'success');
      } else {
        triggerToast(apiRes?.error || 'اتصال به کلودفلر برقرار نشد.', 'error');
      }
    } catch (err) {
      triggerToast('خطا در تست کلودفلر: ' + err.message, 'error');
    } finally {
      setTestingCf(false);
    }
  };

  // Delete / Terminate a Seller Panel Worker & D1 Database on Cloudflare (e.g., if unpaid)
  const handleDeleteSellerDeployment = async (dep) => {
    if (!dep?.workerName) return;
    setDeletingDeployment(dep.workerName);
    try {
      const apiRes = await adminApi.request('delete_seller_deployment', {
        workerName: dep.workerName,
        dbId: dep.dbId || '',
      });
      if (apiRes && apiRes.ok && Array.isArray(apiRes.seller_deployments)) {
        setSellerDeployments(apiRes.seller_deployments);
      } else {
        const nextList = sellerDeployments.filter(d => d.workerName !== dep.workerName);
        await supabase.from('swedpersiska_settings').upsert({
          key: 'seller_deployments',
          value: nextList,
          updated_at: new Date().toISOString(),
        });
        setSellerDeployments(nextList);
      }
      triggerToast(`پنل فروش «${dep.name}» از کلودفلر حذف شد.`, 'success');
    } catch (err) {
      triggerToast('خطا در حذف پنل فروش: ' + err.message, 'error');
    } finally {
      setDeletingDeployment('');
    }
  };

  // Extend 30-day Monthly Subscription (260 SEK/month)
  const handleRenewSellerDeployment = async (dep) => {
    if (!dep?.workerName) return;
    try {
      const baseTime = dep.expiresAt && new Date(dep.expiresAt).getTime() > Date.now()
        ? new Date(dep.expiresAt).getTime()
        : Date.now();
      const nextExpiresAt = new Date(baseTime + 30 * 24 * 60 * 60 * 1000).toISOString();
      const nextList = sellerDeployments.map((d) =>
        d.workerName === dep.workerName ? { ...d, expiresAt: nextExpiresAt, monthlyPrice: 260 } : d
      );
      const apiRes = await adminApi.request('save_settings', { key: 'seller_deployments', value: nextList });
      if (!apiRes || !apiRes.ok) {
        await supabase.from('swedpersiska_settings').upsert({
          key: 'seller_deployments',
          value: nextList,
          updated_at: new Date().toISOString(),
        });
      }
      setSellerDeployments(nextList);
      triggerToast(`اشتراک ۳۰ روزه «${dep.name}» تمدید شد.`, 'success');
    } catch (err) {
      triggerToast('خطا در تمدید اشتراک: ' + err.message, 'error');
    }
  };

  // Save Cloudflare Turnstile Anti-Bot Settings (never persists secretKey to public settings table)
  const saveTurnstileSettings = async (e) => {
    if (e) e.preventDefault();
    setSavingSettings(true);
    try {
      const publicTurnstilePayload = {
        enabled: turnstileSettings.enabled,
        mode: turnstileSettings.mode,
        siteKey: (turnstileSettings.siteKey || '').trim(),
        protectAdminLogin: turnstileSettings.protectAdminLogin,
        protectPostAd: turnstileSettings.protectPostAd
      };
      localStorage.setItem('swedpersiska_turnstile_settings', JSON.stringify(publicTurnstilePayload));
      const apiRes = await adminApi.request('save_settings', { key: 'turnstile_settings', value: publicTurnstilePayload });
      if (!apiRes || !apiRes.ok) {
        const { error } = await supabase
          .from('swedpersiska_settings')
          .upsert({
            key: 'turnstile_settings',
            value: publicTurnstilePayload,
            updated_at: new Date().toISOString()
          });
        if (error) throw error;
      }
      const msg = 'تنظیمات امنیتی و آنتی‌بات کلودفلر با موفقیت ذخیره شد!';
      setSaveSuccessMsg(msg);
      triggerToast(msg, 'success');
      setTimeout(() => setSaveSuccessMsg(''), 3500);
    } catch (err) {
      console.error('Error saving turnstile settings:', err);
      triggerToast('خطا در ذخیره تنظیمات آنتی‌بات: ' + err.message, 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  // Copy helper
  const copyText = (text, keyOrType, label) => {
    if (!text) return;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedKey(keyOrType);
      triggerToast(`${label || 'متن'} کپی شد`);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  };

  // Stats per Country
  const getCountryStats = (cId) => {
    return countryStats[cId] || { total: 0, active: 0, vip: 0, views: 0 };
  };

  // Overall stats
  const activeAdsCount = counts.active;
  const vipAds = counts.vip;

  // Filtered categories (memoized for snappy UI)
  const filteredCategories = useMemo(() => {
    const q = categorySearchQuery.toLowerCase().trim();
    return categoriesList.filter(cat => {
      const matchSearch = !q ||
        cat.fa.toLowerCase().includes(q) ||
        cat.id.toLowerCase().includes(q) ||
        (cat.icon && cat.icon.toLowerCase().includes(q));

      const count = categoryCounts[cat.id] || 0;
      const matchStatus =
        categoryStatusFilter === 'all' ||
        (categoryStatusFilter === 'active' && cat.enabled !== false) ||
        (categoryStatusFilter === 'disabled' && cat.enabled === false) ||
        (categoryStatusFilter === 'has_ads' && count > 0);

      return matchSearch && matchStatus;
    });
  }, [categoriesList, categorySearchQuery, categoryStatusFilter, categoryCounts]);

  // Desktop Power Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // 1. Ctrl+K or Cmd+K: Focus search
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (topSearchRef.current) {
          topSearchRef.current.focus();
          topSearchRef.current.select();
        } else if (searchInputRef.current) {
          searchInputRef.current.focus();
          searchInputRef.current.select();
        }
        return;
      }

      // 2. Escape Key Multi-Layer Dismissal Stack
      if (e.key === 'Escape') {
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
          document.activeElement.blur();
          return;
        }
        if (cityModal.isOpen) {
          setCityModal(prev => ({ ...prev, isOpen: false }));
          return;
        }
        if (cityToDelete) {
          setCityToDelete(null);
          return;
        }
        if (categoryModal.isOpen) {
          setCategoryModal({ isOpen: false, mode: 'add', id: '', fa: '', icon: 'Tag', enabled: true, isSystem: false, errorMsg: '' });
          return;
        }
        if (categoryToDelete) {
          setCategoryToDelete(null);
          return;
        }
        if (selectedAdForModal) {
          setSelectedAdForModal(null);
          return;
        }
        if (mobileSidebarOpen) {
          setMobileSidebarOpen(false);
          return;
        }
        if (searchQuery) {
          setSearchQuery('');
          return;
        }
        if (categorySearchQuery) {
          setCategorySearchQuery('');
          return;
        }
        onClose();
        return;
      }

      // 3. Ignore if typing in an input, textarea or select
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
        return;
      }

      // 4. Tab Navigation (1-4) on Desktop
      if (e.key === '1') handleTabChange('overview');
      else if (e.key === '2') handleTabChange('ads');
      else if (e.key === '3') handleTabChange('categories');
      else if (e.key === '4') handleTabChange('settings');
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cityModal.isOpen, cityToDelete, categoryModal.isOpen, categoryToDelete, selectedAdForModal, mobileSidebarOpen, searchQuery, categorySearchQuery, onClose]);

  useEffect(() => {
    if (!notifOpen) return;
    const handleOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [notifOpen]);

  const notifCount = (counts.pending || 0) + adReports.length;

  // Compute lightweight Revenue & VIP Chart Series (6-month & per-country, zero external chart lib)
  const revenueChartData = useMemo(() => {
    const unitPrice = Number(stripeSettings.vipPrice) || 99;
    const currency = stripeSettings.currency || 'SEK';

    // Build last 6 calendar months
    const now = new Date();
    const monthlySeries = [];
    const monthFormatter = new Intl.DateTimeFormat('fa-IR', { month: 'short' });
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const bucket = monthBuckets[ym] || { total: 0, vip: 0 };
      monthlySeries.push({
        key: ym,
        label: monthFormatter.format(d),
        totalAds: bucket.total || 0,
        vipAds: bucket.vip || 0,
        revenue: (bucket.vip || 0) * unitPrice,
      });
    }

    const countrySeries = countriesList.map((c) => {
      const st = countryStats[c.id] || { total: 0, active: 0, vip: 0, views: 0 };
      return {
        key: c.id,
        label: c.nameFa,
        totalAds: st.active || 0,
        vipAds: st.vip || 0,
        revenue: (st.vip || 0) * unitPrice,
      };
    });

    const series = revenueChartView === 'country' ? countrySeries : monthlySeries;
    const maxRevenue = Math.max(unitPrice, ...series.map((s) => s.revenue));
    const maxTotalAds = Math.max(1, ...series.map((s) => s.totalAds));
    const totalVipRevenue = (counts.vip || 0) * unitPrice;

    return {
      unitPrice,
      currency,
      series,
      maxRevenue,
      maxTotalAds,
      totalVipRevenue,
    };
  }, [stripeSettings.vipPrice, stripeSettings.currency, monthBuckets, countriesList, countryStats, revenueChartView, counts.vip]);

  // ========================================================
  // LOGIN SCREEN - Apple Eye-Comfort Soft-White Focus Card
  // ========================================================
  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#F5F5F7] font-vazir select-none" dir="rtl">
        
        <div className="relative w-full max-w-[400px] rounded-[28px] bg-[#FBFBFC] border border-[#E5E5EA] p-7 sm:p-8 shadow-[0_24px_70px_rgba(29,29,31,0.12)] space-y-6 z-10 animate-in zoom-in-95 duration-200 text-[#1D1D1F]">
          
          {/* Header */}
          <div className="text-center space-y-2.5">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1D1D1F] text-[#FBFBFC] font-black text-sm shadow-xs">
              ل‌ش
            </div>
            <div>
              <h2 className="text-lg font-black text-[#1D1D1F] tracking-tight">ورود به پنل مدیریت</h2>
              <p className="text-xs text-[#6E6E73] font-medium mt-0.5">لینک شو — سامانه مدیریت نیازمندی‌ها</p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {loginError && (
              <div className="rounded-2xl bg-rose-50 border border-rose-200 p-3 text-xs font-semibold text-rose-700 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-rose-500 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-[#1D1D1F] mb-1.5">ایمیل مدیریت</label>
              <input
                type="email"
                required
                placeholder="admin@swedpersiska.se"
                value={adminEmailInput}
                onChange={(e) => setAdminEmailInput(e.target.value)}
                className="w-full rounded-2xl border border-[#D2D2D7] bg-[#F5F5F7] focus:bg-[#FBFBFC] px-3.5 py-2.5 text-xs text-[#1D1D1F] focus:border-[#0066CC] focus:outline-none transition-all font-mono text-left"
                dir="ltr"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-[#1D1D1F]">رمز عبور</label>
                <button
                  type="button"
                  onClick={() => setShowAdminPass((v) => !v)}
                  className="text-[11px] font-semibold text-[#6E6E73] hover:text-[#1D1D1F] cursor-pointer"
                >
                  {showAdminPass ? 'مخفی کردن' : 'نمایش رمز'}
                </button>
              </div>
              <input
                type={showAdminPass ? 'text' : 'password'}
                required
                placeholder="••••••••"
                value={adminPassInput}
                onChange={(e) => setAdminPassInput(e.target.value)}
                className="w-full rounded-2xl border border-[#D2D2D7] bg-[#F5F5F7] focus:bg-[#FBFBFC] px-3.5 py-2.5 text-xs text-[#1D1D1F] focus:border-[#0066CC] focus:outline-none transition-all font-mono text-left"
                dir="ltr"
              />
            </div>

            {/* Cloudflare Turnstile Anti-Bot Verification */}
            {turnstileSettings.enabled !== false && turnstileSettings.protectAdminLogin !== false && (
              <div className="pt-1 flex flex-col items-center justify-center">
                <CloudflareTurnstile
                  theme="light"
                  siteKey={turnstileSettings.mode === 'live' ? turnstileSettings.siteKey : undefined}
                  onVerify={(token) => {
                    setAdminTurnstileToken(token);
                    setLoginError('');
                  }}
                  onExpire={() => setAdminTurnstileToken('')}
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loginSubmitting}
              className="w-full h-11 rounded-full bg-[#0066CC] hover:bg-[#0055AA] disabled:opacity-60 text-white font-bold text-xs shadow-[0_6px_18px_rgba(0,102,204,0.24)] active:scale-[0.96] transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] cursor-pointer"
            >
              {loginSubmitting ? 'در حال ورود...' : 'ورود به پنل'}
            </button>
          </form>

          <button
            type="button"
            onClick={onClose}
            className="w-full text-center text-xs font-semibold text-[#6E6E73] hover:text-[#1D1D1F] transition-colors cursor-pointer pt-0.5"
          >
            بازگشت به وب‌سایت
          </button>
        </div>
      </div>
    );
  }

  // ========================================================
  // MAIN ADMIN WORKSPACE:
  // - Eye-Care Warm Tone Canvas (#f4f3ee)
  // - Dark Charcoal Sidebar (#111217)
  // - Pure Crisp White Cards (#ffffff) with Warm Borders
  // ========================================================
  return (
    <main 
      className="admin-scope h-[100dvh] w-full overflow-hidden bg-[#f4f1ea] text-zinc-900 font-vazir select-none flex flex-col lg:flex-row p-0 lg:p-4 lg:gap-4" 
      dir="rtl"
      data-testid="admin-page"
    >
      
      {/* Prominent Floating Save & Action Confirmation Popup */}
      {actionSuccessMsg && (
        <div
          className={`fixed top-5 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2.5 rounded-2xl px-4 py-3 text-xs font-extrabold shadow-[0_18px_45px_rgba(0,0,0,0.28)] border animate-in fade-in slide-in-from-top-3 duration-200 select-none ${
            actionToastType === 'error'
              ? 'bg-rose-600 text-white border-rose-400/50'
              : 'bg-zinc-950 text-white border-emerald-400/40'
          }`}
        >
          {actionToastType === 'error' ? (
            <AlertCircle size={17} className="text-white shrink-0" />
          ) : (
            <CheckCircle size={17} className="text-[#34c759] shrink-0" />
          )}
          <span>{actionSuccessMsg}</span>
          <button
            type="button"
            onClick={() => setActionSuccessMsg('')}
            className="ms-1 p-0.5 rounded-full hover:bg-white/15 text-white/75 hover:text-white cursor-pointer"
            title="بستن"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* ========================================================
          1. DESKTOP STATIONARY SIDEBAR (COMPACT & CLEAN)
      ======================================================== */}
      <aside
        className="hidden lg:flex flex-col justify-between w-[256px] shrink-0 h-full bg-[#11141a] text-white rounded-2xl p-3.5 border border-stone-800/80 select-none z-30"
        data-testid="admin-sidebar"
      >
        <div className="flex flex-col w-full min-h-0 flex-1">
          <div className="flex h-14 items-center justify-between px-2 pb-2.5 border-b border-stone-800/90 shrink-0">
            <div className="flex items-center gap-2.5 cursor-pointer min-w-0" onClick={onClose} title="مشاهده وب‌سایت">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-slate-950 font-black text-xs">
                <span>ل‌ش</span>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-black text-[14.5px] tracking-tight leading-tight text-white truncate">لینک شو</span>
                <span className="text-[10.5px] text-stone-400 font-medium truncate">پنل مدیریت</span>
              </div>
            </div>
          </div>

          {/* Clean Single Navigation List */}
          <div className="flex-1 overflow-y-auto no-scrollbar py-3 space-y-1">
            {[
              {
                id: 'overview',
                label: 'داشبورد',
                active: activeTab === 'overview',
                onClick: () => handleTabChange('overview'),
              },
              {
                id: 'active-ads',
                label: 'آگهی‌های فعال',
                badge: counts.active || 0,
                active: activeTab === 'ads' && adStatusFilter === 'active' && !vipOnlyFilter,
                onClick: () => openAdsPreset('active', false),
              },
              {
                id: 'pending-ads',
                label: 'در انتظار تایید',
                badge: counts.pending || 0,
                badgeAlert: (counts.pending || 0) > 0,
                active: activeTab === 'ads' && adStatusFilter === 'pending' && !vipOnlyFilter,
                onClick: () => openAdsPreset('pending', false),
              },
              {
                id: 'vip-ads',
                label: 'آگهی‌های ویژه (VIP)',
                badge: counts.vip || 0,
                active: activeTab === 'ads' && vipOnlyFilter,
                onClick: () => openAdsPreset('active', true),
              },
              {
                id: 'reports',
                label: 'گزارش‌های تخلف',
                badge: adReports.length,
                badgeAlert: adReports.length > 0,
                active: activeTab === 'reports',
                onClick: () => handleTabChange('reports'),
              },
              {
                id: 'websites',
                label: 'وب‌سایت‌ها و فروشگاه‌ها',
                badge: sellerDeployments.length,
                active: activeTab === 'websites',
                onClick: () => handleTabChange('websites'),
              },
              {
                id: 'categories',
                label: 'دسته‌بندی و شهرها',
                active: activeTab === 'categories',
                onClick: () => handleTabChange('categories'),
              },
              {
                id: 'settings',
                label: 'تنظیمات سایت',
                active: activeTab === 'settings',
                onClick: () => handleTabChange('settings'),
              },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={item.onClick}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-[13px] transition-colors cursor-pointer ${
                  item.active
                    ? 'bg-white text-slate-950 font-bold'
                    : 'text-stone-300 hover:bg-white/10 hover:text-white font-medium'
                }`}
              >
                <span className="truncate">{item.label}</span>
                {typeof item.badge === 'number' && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10.5px] font-mono font-bold tabular-nums ${
                      item.active
                        ? 'bg-slate-900/10 text-slate-900'
                        : item.badgeAlert
                          ? 'bg-rose-500 text-white'
                          : 'bg-white/10 text-stone-300'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="pt-3 border-t border-stone-800/90 w-full shrink-0">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 flex items-center justify-center gap-1.5 rounded-xl px-2.5 text-xs font-bold text-stone-100 bg-white/10 hover:bg-white/15 border border-white/10 transition-colors cursor-pointer"
              title="مشاهده وب‌سایت"
            >
              <Globe2 size={14} className="text-blue-400 shrink-0" />
              <span>وب‌سایت</span>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="h-9 flex items-center justify-center gap-1.5 rounded-xl px-2.5 text-xs font-bold text-rose-300 bg-rose-950/35 hover:bg-rose-950/55 border border-rose-800/40 transition-colors cursor-pointer"
              title="خروج از حساب"
            >
              <LogOut size={14} className="shrink-0" />
              <span>خروج</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Slide-in Drawer (Zero GPU blur overhead) */}
      <div
        className={`fixed inset-0 z-50 lg:hidden font-vazir select-none transition-[visibility] duration-200 ${
          mobileSidebarOpen ? 'pointer-events-auto visible' : 'pointer-events-none invisible'
        }`}
        dir="rtl"
        aria-hidden={!mobileSidebarOpen}
      >
        <div
          className={`fixed inset-0 bg-black/50 transition-opacity duration-200 ${
            mobileSidebarOpen ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={() => setMobileSidebarOpen(false)}
        />

        <div
          className={`relative z-10 w-72 max-w-[84vw] h-full bg-[#11141a] text-white flex flex-col border-s border-stone-800/80 shadow-xl transform transition-transform duration-200 will-change-transform ${
            mobileSidebarOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="flex h-14 items-center justify-between px-4 border-b border-stone-800/80 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-white text-zinc-950 font-black text-xs flex items-center justify-center">
                ل‌ش
              </div>
              <span className="font-extrabold text-[13.5px] text-white">پنل مدیریت لینک شو</span>
            </div>
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(false)}
              className="h-8 w-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/15 text-stone-300 hover:text-white cursor-pointer"
              title="بستن منو"
            >
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar p-3 space-y-1">
            {[
              {
                id: 'overview',
                label: 'داشبورد',
                active: activeTab === 'overview',
                onClick: () => handleTabChange('overview'),
              },
              {
                id: 'active-ads',
                label: 'آگهی‌های فعال',
                badge: counts.active || 0,
                active: activeTab === 'ads' && adStatusFilter === 'active' && !vipOnlyFilter,
                onClick: () => openAdsPreset('active', false),
              },
              {
                id: 'pending-ads',
                label: 'در انتظار تایید',
                badge: counts.pending || 0,
                badgeAlert: (counts.pending || 0) > 0,
                active: activeTab === 'ads' && adStatusFilter === 'pending' && !vipOnlyFilter,
                onClick: () => openAdsPreset('pending', false),
              },
              {
                id: 'vip-ads',
                label: 'آگهی‌های ویژه (VIP)',
                badge: counts.vip || 0,
                active: activeTab === 'ads' && vipOnlyFilter,
                onClick: () => openAdsPreset('active', true),
              },
              {
                id: 'reports',
                label: 'گزارش‌های تخلف',
                badge: adReports.length,
                badgeAlert: adReports.length > 0,
                active: activeTab === 'reports',
                onClick: () => handleTabChange('reports'),
              },
              {
                id: 'websites',
                label: 'وب‌سایت‌ها و فروشگاه‌ها',
                badge: sellerDeployments.length,
                active: activeTab === 'websites',
                onClick: () => handleTabChange('websites'),
              },
              {
                id: 'categories',
                label: 'دسته‌بندی و شهرها',
                active: activeTab === 'categories',
                onClick: () => handleTabChange('categories'),
              },
              {
                id: 'settings',
                label: 'تنظیمات سایت',
                active: activeTab === 'settings',
                onClick: () => handleTabChange('settings'),
              },
            ].map(item => (
              <button
                key={item.id}
                type="button"
                onClick={item.onClick}
                className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-[13px] transition-colors cursor-pointer ${
                  item.active
                    ? 'bg-white text-slate-950 font-bold'
                    : 'text-stone-300 hover:bg-white/10 hover:text-white font-medium'
                }`}
              >
                <span>{item.label}</span>
                {typeof item.badge === 'number' && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-bold tabular-nums ${
                      item.badgeAlert
                        ? 'bg-rose-500 text-white'
                        : item.active
                        ? 'bg-slate-900/10 text-slate-900'
                        : 'bg-white/10 text-stone-300'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="p-3 border-t border-stone-800/80 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 flex items-center justify-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold cursor-pointer"
            >
              <Globe2 size={14} className="text-blue-400" />
              <span>وب‌سایت</span>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="h-9 flex items-center justify-center gap-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-bold cursor-pointer"
            >
              <LogOut size={14} />
              <span>خروج</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Header (Fixed top bar outside scroll container — crisp full-width, zero sticky bugs) */}
      <header className="lg:hidden shrink-0 flex items-center justify-between h-14 w-full px-3 bg-white border-b border-stone-200/80 select-none z-30 gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(true)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-800 hover:bg-stone-100 active:scale-95 transition-transform cursor-pointer"
            title="باز کردن منو"
            aria-label="باز کردن منو"
          >
            <Menu size={18} />
          </button>
          <div className="flex flex-col min-w-0">
            <span className="font-black text-[13.5px] text-stone-900 truncate leading-tight">
              {activeTab === 'overview' && 'داشبورد مدیریت'}
              {activeTab === 'ads' && (vipOnlyFilter ? 'آگهی‌های ویژه' : adStatusFilter === 'pending' ? 'در انتظار تایید' : 'مدیریت آگهی‌ها')}
              {activeTab === 'reports' && 'گزارش‌های تخلف'}
              {activeTab === 'websites' && 'وب‌سایت‌ها و فروشگاه‌ها'}
              {activeTab === 'categories' && 'دسته‌بندی و شهرها'}
              {activeTab === 'settings' && 'تنظیمات سایت'}
            </span>
            <span className="text-[10px] text-stone-400 font-medium truncate leading-tight">پنل ادمین لینک شو</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              if ((counts.pending || 0) > 0) {
                openAdsPreset('pending', false);
              } else if (adReports.length > 0) {
                handleTabChange('reports');
              } else {
                openAdsPreset('pending', false);
              }
            }}
            className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 cursor-pointer"
            title="اعلان‌های مدیریت"
          >
            <Bell size={16} />
            {notifCount > 0 && (
              <span className="absolute -top-1 -left-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-600 px-1 text-[9.5px] font-bold text-white ring-2 ring-white tabular-nums">
                {notifCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={fetchAdminData}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 cursor-pointer"
            title="بروزرسانی"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin text-blue-600' : ''} />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-2.5 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold flex items-center gap-1 shrink-0 cursor-pointer"
          >
            <ExternalLink size={13} />
            <span>سایت</span>
          </button>
        </div>
      </header>

      {/* ========================================================
          2. MAIN SCROLLABLE CONTENT AREA (INDEPENDENT FROM SIDEBAR)
      ======================================================== */}
      <div ref={mainScrollRef} className="flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden no-scrollbar flex flex-col min-w-0 px-3 pt-3 pb-8 sm:px-4 lg:px-0 lg:pt-0 lg:pb-8">
        
        {/* Top Desktop Nav Bar (Solid crisp white — zero GPU blur lag) */}
        <header className="hidden lg:flex items-center justify-between h-14 px-4 bg-white rounded-2xl border border-stone-200/90 mb-4 sticky top-0 shrink-0 z-20 select-none gap-4">
          <div className="flex items-center gap-2.5 shrink-0">
            <span className="font-black text-stone-900 tracking-tight text-[15px]">
              {activeTab === 'overview' && 'داشبورد مدیریت'}
              {activeTab === 'ads' && 'مدیریت آگهی‌ها'}
              {activeTab === 'reports' && 'گزارش‌های تخلف'}
              {activeTab === 'websites' && 'وب‌سایت‌ها و فروشگاه‌ها'}
              {activeTab === 'categories' && 'دسته‌بندی و شهرها'}
              {activeTab === 'settings' && 'تنظیمات سایت'}
            </span>
          </div>

          <div className="flex items-center justify-end gap-2 flex-1 min-w-0">
            {/* Debounced Search Bar */}
            <div className="relative flex-1 max-w-sm min-w-[180px]">
              <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
              <input
                ref={topSearchRef}
                type="search"
                value={searchQuery}
                onChange={(e) => handleDebouncedSearch(e.target.value, true)}
                placeholder="جستجوی سریع آگهی، شهر یا کد رهگیری..."
                className="w-full h-9 pr-9 pl-8 bg-stone-50 focus:bg-white text-xs text-stone-900 placeholder:text-stone-400 rounded-xl border border-stone-200/90 focus:border-blue-500 outline-none transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => handleDebouncedSearch('', false)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-700 rounded-md cursor-pointer"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={fetchAdminData}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 cursor-pointer"
              title="بروزرسانی اطلاعات"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin text-blue-600' : ''} />
            </button>

            {/* Notification Bell */}
            <div className="relative shrink-0" ref={notifRef}>
              <button
                type="button"
                onClick={() => setNotifOpen(v => !v)}
                className={`relative flex h-9 w-9 items-center justify-center rounded-xl border transition-colors cursor-pointer ${
                  notifOpen
                    ? 'border-blue-300 bg-blue-50 text-blue-700'
                    : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
                }`}
                title={notifCount > 0 ? `${notifCount} مورد نیازمند بررسی` : 'اعلان جدیدی وجود ندارد'}
              >
                <Bell size={16} />
                {notifCount > 0 && (
                  <span className="absolute -top-1 -left-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-600 px-1 text-[9.5px] font-bold text-white ring-2 ring-white tabular-nums">
                    {notifCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute left-0 top-full mt-2 w-68 rounded-2xl bg-white border border-stone-200 shadow-xl p-2 z-50">
                  <div className="px-3 py-2 border-b border-stone-100 flex items-center justify-between">
                    <span className="text-xs font-extrabold text-stone-900">اعلان‌های مدیریت</span>
                    {notifCount > 0 && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 tabular-nums">
                        {notifCount} مورد
                      </span>
                    )}
                  </div>

                  <div className="py-1 space-y-1">
                    <button
                      type="button"
                      onClick={() => {
                        setNotifOpen(false);
                        openAdsPreset('pending', false);
                      }}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-stone-50 text-right transition-colors cursor-pointer"
                    >
                      <span className="text-xs font-bold text-stone-900">آگهی‌های در انتظار تایید</span>
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold tabular-nums ${
                        (counts.pending || 0) > 0 ? 'bg-amber-500 text-white' : 'bg-stone-100 text-stone-500'
                      }`}>
                        {counts.pending || 0}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setNotifOpen(false);
                        handleTabChange('reports');
                      }}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-stone-50 text-right transition-colors cursor-pointer"
                    >
                      <span className="text-xs font-bold text-stone-900">گزارش‌های تخلف کاربران</span>
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold tabular-nums ${
                        adReports.length > 0 ? 'bg-rose-600 text-white' : 'bg-stone-100 text-stone-500'
                      }`}>
                        {adReports.length}
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ========================================================
            3. CONTENT CANVAS (Persian RTL)
        ======================================================== */}
        <div className="flex-1 flex flex-col min-w-0" dir="rtl">
          
          {/* ========================================================
              TAB 1: CLEAN, FAST, UNCLUTTERED OVERVIEW DASHBOARD
          ======================================================== */}
          {activeTab === 'overview' && (
            <div className="space-y-4 w-full">
              
              {/* 1. ROW 1: 4 Compact KPI Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <button
                  type="button"
                  onClick={() => openAdsPreset('active', false)}
                  className="rounded-2xl border border-stone-200/80 bg-white p-4 text-right hover:border-blue-400 transition-colors cursor-pointer flex items-center justify-between gap-3"
                >
                  <div>
                    <span className="text-xs font-bold text-stone-500 block">آگهی‌های فعال</span>
                    <span className="text-2xl font-black text-stone-900 tabular-nums mt-1 block">{activeAdsCount}</span>
                  </div>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <Layers3 size={18} />
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => openAdsPreset('active', true)}
                  className="rounded-2xl border border-stone-200/80 bg-white p-4 text-right hover:border-amber-400 transition-colors cursor-pointer flex items-center justify-between gap-3"
                >
                  <div>
                    <span className="text-xs font-bold text-stone-500 block">آگهی‌های ویژه (VIP)</span>
                    <span className="text-2xl font-black text-stone-900 tabular-nums mt-1 block">{vipAds}</span>
                  </div>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                    <Sparkles size={18} />
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => openAdsPreset('pending', false)}
                  className="rounded-2xl border border-stone-200/80 bg-white p-4 text-right hover:border-amber-400 transition-colors cursor-pointer flex items-center justify-between gap-3"
                >
                  <div>
                    <span className="text-xs font-bold text-stone-500 block">در انتظار تایید</span>
                    <span className="text-2xl font-black text-stone-900 tabular-nums mt-1 block">{counts.pending || 0}</span>
                  </div>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                    <Bell size={18} />
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleTabChange('reports')}
                  className="rounded-2xl border border-stone-200/80 bg-white p-4 text-right hover:border-rose-400 transition-colors cursor-pointer flex items-center justify-between gap-3"
                >
                  <div>
                    <span className="text-xs font-bold text-stone-500 block">گزارش‌های تخلف</span>
                    <span className="text-2xl font-black text-stone-900 tabular-nums mt-1 block">{adReports.length}</span>
                  </div>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                    <AlertCircle size={18} />
                  </div>
                </button>
              </div>

              {/* 2. ROW 2: TWO-COLUMN DASHBOARD — RIGHT: Countries & Recent Ads | LEFT: Beautiful Revenue Chart */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch">
                
                {/* RIGHT SIDE (RTL Col 1): Country Stats + Recent Ads */}
                <div className="xl:col-span-6 flex flex-col gap-4 min-w-0">
                  
                  {/* Compact 8-Country Breakdown */}
                  <div className="rounded-2xl border border-stone-200/80 bg-white p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs font-black text-zinc-900">آمار کشورها ({countriesList.length} کشور)</h3>
                      </div>
                      <span className="text-[11px] text-stone-400">کلیک برای فیلتر کشور</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-4 gap-2">
                      {countriesList.map(country => {
                        const stats = getCountryStats(country.id);
                        return (
                          <button
                            key={country.id}
                            type="button"
                            onClick={() => {
                              setCountryFilter(country.id);
                              handleTabChange('ads');
                              fetchActiveAds(1, searchQuery, country.id, categoryFilter, adStatusFilter, vipOnlyFilter);
                            }}
                            className="px-2.5 py-2 rounded-xl border border-stone-200/80 hover:border-blue-400 bg-stone-50/60 hover:bg-white transition-colors cursor-pointer flex items-center justify-between gap-1.5 text-right"
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              {renderCountryFlag(country.id)}
                              <span className="font-bold text-xs text-stone-900 truncate">
                                {country.nameFa}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0 text-[11px] tabular-nums">
                              <span className="font-bold text-stone-800">{stats.active}</span>
                              {stats.vip > 0 && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                                  {stats.vip}★
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Clean Recent Ads List */}
                  <div className="flex-1 rounded-2xl border border-stone-200/80 bg-white p-4 space-y-3 flex flex-col">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-xs sm:text-sm font-black text-stone-900">آخرین آگهی‌های ثبت‌شده</h2>
                      <button
                        type="button"
                        onClick={() => handleTabChange('ads')}
                        className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
                      >
                        <span>مشاهده همه ({counts.active})</span>
                        <span>←</span>
                      </button>
                    </div>

                    <div className="divide-y divide-stone-100 rounded-xl border border-stone-200/70 overflow-hidden">
                      {recentActiveAds.map(ad => {
                        const countryObj = countriesList.find(c => c.id === (ad.country || 'se')) || countriesList[0];
                        const catObj = categoriesList.find(c => c.id === ad.category) || CATEGORIES.find(c => c.id === ad.category);
                        return (
                          <div
                            key={ad.id}
                            className="w-full p-2.5 flex items-center justify-between gap-2.5 text-right hover:bg-stone-50 transition-colors"
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <div 
                                onClick={() => setSelectedAdForModal(ad)}
                                className="w-10 h-10 rounded-xl bg-stone-100 border border-stone-200/80 overflow-hidden shrink-0 cursor-pointer"
                              >
                                {ad.images && ad.images[0] ? (
                                  <img src={ad.images[0]} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-stone-300">
                                    <ImageIcon size={15} />
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-stone-100 text-stone-700 shrink-0">
                                    {renderCountryFlag(ad.country || 'se')}
                                    <span>{countryObj.nameFa}</span>
                                  </span>
                                  {ad.is_featured && (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200/70 shrink-0">
                                      ویژه
                                    </span>
                                  )}
                                  {catObj && (
                                    <span className="text-[10.5px] text-stone-400">· {catObj.fa}</span>
                                  )}
                                </div>
                                <p 
                                  onClick={() => setSelectedAdForModal(ad)}
                                  className="text-xs font-bold text-stone-900 hover:text-blue-600 truncate mt-0.5 cursor-pointer"
                                >
                                  {ad.title}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => setSelectedAdForModal(ad)}
                                className="h-8 px-2.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 text-[11px] font-bold cursor-pointer"
                              >
                                مشاهده
                              </button>

                              <button
                                type="button"
                                onClick={() => toggleFeatured(ad)}
                                className={`h-8 w-8 shrink-0 rounded-lg border flex items-center justify-center cursor-pointer ${
                                  ad.is_featured
                                    ? 'bg-amber-50 text-amber-800 border-amber-300'
                                    : 'bg-white hover:bg-stone-50 text-stone-400 border-stone-200'
                                }`}
                                title={ad.is_featured ? 'حذف نشان ویژه' : 'ارتقا به ویژه'}
                              >
                                <Sparkles size={13} className={ad.is_featured ? 'text-amber-600' : 'text-stone-400'} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                      {recentActiveAds.length === 0 && (
                        <div className="py-8 text-center text-xs text-stone-400">
                          هنوز آگهی فعالی در سیستم ثبت نشده است.
                        </div>
                      )}
                    </div>
                  </div>

                </div>

                {/* LEFT SIDE (RTL Col 2): Beautiful Revenue & VIP Chart */}
                <div className="xl:col-span-6 flex flex-col min-w-0">
                  <div className="flex-1 rounded-2xl border border-stone-200/80 bg-white p-4 sm:p-5 flex flex-col justify-between gap-4">
                    
                    {/* Top Header */}
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#0066CC] to-[#0ea5e9] text-white shadow-sm">
                            <WalletCards size={18} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-xs sm:text-sm font-black text-zinc-900">چارت درآمد و آگهی‌های ویژه</h3>
                              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-[10px] font-bold tabular-nums">
                                {vipAds} ویژه × {revenueChartData.unitPrice} {revenueChartData.currency}
                              </span>
                            </div>
                            <div className="flex items-baseline gap-2 mt-0.5">
                              <span className="text-xl sm:text-2xl font-black text-zinc-900 tabular-nums" dir="ltr">
                                {revenueChartData.totalVipRevenue.toLocaleString('en-US')} {revenueChartData.currency}
                              </span>
                              <span className="text-[11px] text-stone-400">درآمد کل تخمینی VIP</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap">
                          <div className="inline-flex items-center rounded-xl bg-stone-100 p-1 border border-stone-200/80">
                            <button
                              type="button"
                              onClick={() => { setRevenueChartView('monthly'); setActiveChartIdx(null); }}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                                revenueChartView === 'monthly'
                                  ? 'bg-white text-zinc-900 shadow-sm'
                                  : 'text-stone-500 hover:text-zinc-900'
                              }`}
                            >
                              ۶ ماهه
                            </button>
                            <button
                              type="button"
                              onClick={() => { setRevenueChartView('country'); setActiveChartIdx(null); }}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                                revenueChartView === 'country'
                                  ? 'bg-white text-zinc-900 shadow-sm'
                                  : 'text-stone-500 hover:text-zinc-900'
                              }`}
                            >
                              کشورها
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleTabChange('monetization')}
                            className="h-8 px-2.5 rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 text-[11px] font-bold text-stone-700 cursor-pointer"
                          >
                            تعرفه
                          </button>
                        </div>
                      </div>

                      {/* Selected / Hovered Column Summary Strip */}
                      {(() => {
                        const defaultIdx = revenueChartView === 'monthly' ? revenueChartData.series.length - 1 : 0;
                        const resolvedIdx = activeChartIdx !== null && revenueChartData.series[activeChartIdx] ? activeChartIdx : defaultIdx;
                        const selectedBar = revenueChartData.series[resolvedIdx];
                        if (!selectedBar) return null;
                        return (
                          <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-gradient-to-l from-stone-50 to-blue-50/40 border border-stone-200/80 text-[11px]">
                            <div className="flex items-center gap-2 font-black text-zinc-900">
                              <span className="h-2 w-2 rounded-full bg-[#0066CC]" />
                              <span>{selectedBar.label}</span>
                            </div>
                            <div className="flex items-center gap-3 tabular-nums">
                              <span className="text-stone-500">
                                کل آگهی: <strong className="text-zinc-900">{selectedBar.totalAds}</strong>
                              </span>
                              <span className="text-amber-700">
                                ویژه: <strong>{selectedBar.vipAds}</strong>
                              </span>
                              <span className="px-2 py-0.5 rounded-md bg-emerald-100/80 text-emerald-800 font-black" dir="ltr">
                                {selectedBar.revenue.toLocaleString('en-US')} {revenueChartData.currency}
                              </span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Sleek Tracked Column Chart */}
                    <div className="flex-1 flex flex-col justify-end pt-2">
                      <div
                        className={`grid gap-1.5 sm:gap-2 items-end h-52 sm:h-60 ${
                          revenueChartView === 'country' ? 'grid-cols-8' : 'grid-cols-6'
                        }`}
                      >
                        {revenueChartData.series.map((item, idx) => {
                          const revPct = item.revenue > 0 ? Math.max(12, Math.round((item.revenue / revenueChartData.maxRevenue) * 100)) : 0;
                          const adsPct = item.totalAds > 0 ? Math.max(10, Math.round((item.totalAds / revenueChartData.maxTotalAds) * 100)) : 0;
                          const defaultIdx = revenueChartView === 'monthly' ? revenueChartData.series.length - 1 : 0;
                          const isActive = (activeChartIdx !== null ? activeChartIdx : defaultIdx) === idx;
                          return (
                            <button
                              key={item.key}
                              type="button"
                              onMouseEnter={() => setActiveChartIdx(idx)}
                              onClick={() => setActiveChartIdx(idx)}
                              className={`group flex flex-col items-center justify-end h-full gap-2 rounded-2xl p-1.5 sm:p-2 transition-all cursor-pointer focus:outline-none min-w-0 ${
                                isActive
                                  ? 'bg-blue-50/60 ring-1 ring-[#0066CC]/25'
                                  : 'bg-stone-50/80 hover:bg-stone-100/80'
                              }`}
                            >
                              <span
                                className={`text-[10px] font-bold tabular-nums h-4 leading-4 truncate max-w-full ${
                                  isActive ? 'text-[#0066CC]' : 'text-stone-500'
                                }`}
                              >
                                {item.revenue > 0 ? `${item.revenue}` : item.totalAds > 0 ? `${item.totalAds}` : '۰'}
                              </span>

                              <div className="relative w-full flex-1 flex items-end justify-center gap-1 px-0.5">
                                {/* Total ads track bar */}
                                <div
                                  style={{ height: `${adsPct || 6}%` }}
                                  className={`w-2 sm:w-2.5 rounded-full transition-all duration-300 ${
                                    item.totalAds > 0
                                      ? 'bg-stone-300 group-hover:bg-stone-400'
                                      : 'bg-stone-200/60'
                                  }`}
                                  title={`کل آگهی‌ها: ${item.totalAds}`}
                                />
                                {/* VIP Revenue gradient bar */}
                                <div
                                  style={{ height: `${revPct || 6}%` }}
                                  className={`w-2.5 sm:w-3.5 rounded-full transition-all duration-300 ${
                                    item.revenue > 0
                                      ? 'bg-gradient-to-t from-[#0066CC] via-[#0ea5e9] to-[#38bdf8] shadow-[0_4px_12px_rgba(0,102,204,0.28)]'
                                      : 'bg-stone-200/60'
                                  }`}
                                  title={`درآمد VIP: ${item.revenue} ${revenueChartData.currency}`}
                                />
                              </div>

                              <span
                                className={`text-[10px] sm:text-[11px] font-bold truncate max-w-full ${
                                  isActive ? 'text-[#0066CC]' : 'text-stone-600'
                                }`}
                              >
                                {item.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Footer Legend */}
                      <div className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-stone-100 text-[10.5px] text-stone-500 flex-wrap">
                        <div className="flex items-center gap-3.5">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="h-2.5 w-2.5 rounded-full bg-gradient-to-t from-[#0066CC] to-[#38bdf8]" />
                            <span>درآمد VIP ({revenueChartData.currency})</span>
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <span className="h-2.5 w-2.5 rounded-full bg-stone-300" />
                            <span>تعداد آگهی‌ها</span>
                          </span>
                        </div>
                        <span className="text-[10px] text-stone-400">روی هر ستون کلیک یا هاور کنید</span>
                      </div>
                    </div>

                  </div>
                </div>

              </div>

            </div>
          )}

          {/* ========================================================
              TAB 2: HIGH-DENSITY LUXURY TABLE (PERSIAN RTL)
          ======================================================== */}
          {activeTab === 'ads' && (
            <div className="space-y-4 w-full animate-in fade-in duration-150 ease-out">
              
              {/* Filter Controls Bar */}
              <div className="p-4 rounded-2xl border border-stone-200/80 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-3">

                {/* 1. Country Filter Pills */}
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                  <span className="text-xs font-bold text-stone-500 shrink-0">کشور:</span>
                  
                  <div className="p-1 rounded-xl bg-stone-100/80 border border-stone-200/80 inline-flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        playFeedback('select');
                        setCountryFilter('all');
                        fetchActiveAds(1, searchQuery, 'all', categoryFilter, adStatusFilter, vipOnlyFilter);
                      }}
                      className={`min-h-[30px] px-3.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all select-none active:scale-95 cursor-pointer ${
                        countryFilter === 'all'
                          ? 'bg-white text-zinc-950 shadow-xs'
                          : 'text-stone-600 hover:text-zinc-950 hover:bg-white/50'
                      }`}
                    >
                      همه ({counts.active})
                    </button>

                    {countriesList.map(country => {
                      const count = countryStats[country.id]?.active || 0;
                      const isSelected = countryFilter === country.id;

                      return (
                        <button
                          key={country.id}
                          type="button"
                          onClick={() => {
                            playFeedback('select');
                            setCountryFilter(country.id);
                            fetchActiveAds(1, searchQuery, country.id, categoryFilter, adStatusFilter, vipOnlyFilter);
                          }}
                          className={`min-h-[30px] px-3 rounded-lg text-xs font-bold whitespace-nowrap transition-all select-none flex items-center gap-1.5 active:scale-95 cursor-pointer ${
                            isSelected
                              ? 'bg-white text-zinc-950 shadow-xs'
                              : 'text-stone-600 hover:text-zinc-950 hover:bg-white/50'
                          }`}
                        >
                          {renderCountryFlag(country.id)}
                          <span>{country.nameFa}</span>
                          <span className={`text-[10.5px] font-mono ${isSelected ? 'text-blue-600' : 'opacity-60'}`}>
                            ({count})
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Search & Category Dropdowns */}
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <div className="relative flex-1">
                    <Search size={15} className="absolute start-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      placeholder="جستجو در عنوان، کد پیگیری، شهر، نام تماس، ایمیل..."
                      value={searchQuery}
                      onChange={(e) => handleDebouncedSearch(e.target.value, false)}
                      className="w-full h-10 rounded-xl bg-stone-50 hover:bg-stone-100/70 focus:bg-white border border-stone-200/80 ps-9 pe-8 text-xs text-zinc-900 placeholder:text-stone-400 focus:border-stone-400 focus:outline-none transition-all shadow-2xs"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => handleDebouncedSearch('', false)}
                        className="absolute end-2.5 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-600 rounded-md cursor-pointer"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={categoryFilter}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCategoryFilter(val);
                        fetchActiveAds(1, searchQuery, countryFilter, val, adStatusFilter, vipOnlyFilter);
                      }}
                      className="flex-1 sm:flex-initial h-10 rounded-xl bg-stone-50 border border-stone-200/80 px-3 text-xs font-semibold text-zinc-800 focus:bg-white focus:border-stone-400 focus:outline-none cursor-pointer shadow-2xs"
                    >
                      <option value="all">همه دسته‌ها</option>
                      {categoriesList.map(c => (
                        <option key={c.id} value={c.id}>{c.fa}</option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => fetchActiveAds(activePage, searchQuery, countryFilter, categoryFilter, adStatusFilter, vipOnlyFilter)}
                      className="h-10 px-3 rounded-xl border border-stone-200/80 bg-stone-50 hover:bg-white text-stone-700 text-xs font-semibold flex items-center gap-1.5 shadow-2xs active:scale-95 transition-all cursor-pointer shrink-0"
                      title="بروزرسانی جدول"
                    >
                      <RotateCcw size={13} className={activeLoading ? 'animate-spin text-blue-600' : 'text-stone-500'} />
                      <span className="hidden sm:inline">تازه کردن</span>
                    </button>
                  </div>
                </div>

              </div>

              {/* High-Density Luxury Ads Table (10 per page) */}
              <div className="bg-white rounded-2xl border border-stone-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.03)] overflow-hidden">
                {activeLoading && activeAds.length === 0 ? (
                  <div className="text-center py-20 p-8 text-stone-400 space-y-2">
                    <RefreshCw size={28} className="mx-auto text-blue-600 animate-spin" />
                    <p className="text-xs text-stone-500 font-semibold">در حال دریافت داده‌های بهینه‌شده از پایگاه داده...</p>
                  </div>
                ) : activeAds.length === 0 ? (
                  <div className="text-center py-20 p-8 text-stone-400 space-y-2">
                    <Layers size={36} className="mx-auto text-stone-300" />
                    <p className="text-sm font-semibold text-stone-600">هیچ آگهی فعالی با این فیلترها یافت نشد.</p>
                    <p className="text-xs text-stone-400">فیلترهای جستجو یا کشور را تغییر دهید.</p>
                  </div>
                ) : (
                  <>
                    {/* Mobile Cards View (< md) */}
                    <div className="md:hidden divide-y divide-stone-100">
                      {activeAds.map(ad => {
                        const countryObj = countriesList.find(c => c.id === (ad.country || 'se')) || countriesList[0];
                        const catObj = categoriesList.find(c => c.id === ad.category) || CATEGORIES.find(c => c.id === ad.category);
                        return (
                          <div key={`m-${ad.id}`} className="p-3.5 space-y-3 hover:bg-blue-50/30 transition-colors">
                            <div className="flex items-start gap-3">
                              <div
                                onClick={() => setSelectedAdForModal(ad)}
                                className="w-14 h-14 rounded-xl bg-stone-100 border border-stone-200/80 overflow-hidden shrink-0 cursor-pointer shadow-2xs"
                              >
                                {ad.images && ad.images[0] ? (
                                  <img src={ad.images[0]} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-stone-300 bg-stone-50">
                                    <ImageIcon size={20} />
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0 flex-1 space-y-1.5">
                                <div className="flex items-center flex-wrap gap-1.5">
                                  <span className="px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-blue-50 text-blue-700 border border-blue-200/70 inline-flex items-center gap-1 whitespace-nowrap">
                                    {renderCountryFlag(ad.country || 'se')}
                                    <span>{countryObj.nameFa}</span>
                                  </span>
                                  {ad.is_featured && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[10px] font-extrabold border border-amber-300 whitespace-nowrap">
                                      <Sparkles size={10} className="text-amber-600" />
                                      <span>ویژه</span>
                                    </span>
                                  )}
                                </div>
                                <p
                                  onClick={() => setSelectedAdForModal(ad)}
                                  className="font-extrabold text-[13.5px] text-stone-900 hover:text-blue-600 cursor-pointer line-clamp-2 leading-snug"
                                >
                                  {ad.title}
                                </p>
                                <div className="flex items-center flex-wrap gap-x-2.5 gap-y-1 text-[11px] text-stone-500">
                                  {catObj && (
                                    <span className="px-1.5 py-0.5 rounded bg-stone-100 text-stone-600 font-medium text-[10.5px]">
                                      {catObj.fa}
                                    </span>
                                  )}
                                  <span className="inline-flex items-center gap-1 text-stone-700 font-medium">
                                    <MapPin size={11} className="text-stone-400" />
                                    {ad.city || 'نامشخص'}
                                  </span>
                                  <span className="font-extrabold text-stone-900 tabular-nums whitespace-nowrap">
                                    {ad.price ? `${Number(ad.price).toLocaleString('sv-SE')} ${ad.price_type === 'kr' || !ad.price_type ? 'کرون' : ad.price_type}` : 'توافقی'}
                                  </span>
                                  <span className="inline-flex items-center gap-1 font-mono text-stone-500">
                                    <Eye size={11} />
                                    {ad.views_count || 1}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 pt-1">
                              {ad.status !== 'active' && (
                                <button
                                  type="button"
                                  onClick={() => approveAdAdmin(ad.id)}
                                  className="h-9 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11.5px] font-bold flex items-center justify-center gap-1 cursor-pointer active:scale-95 shrink-0"
                                  title="تایید و انتشار در سایت"
                                >
                                  <CheckCircle size={14} />
                                  <span>تایید</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setSelectedAdForModal(ad)}
                                className="flex-1 h-9 px-3 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 text-[11.5px] font-bold flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                              >
                                <Eye size={14} className="text-stone-500" />
                                <span>مشاهده</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleFeatured(ad)}
                                className={`h-9 w-9 shrink-0 rounded-lg border flex items-center justify-center cursor-pointer active:scale-95 ${
                                  ad.is_featured
                                    ? 'bg-amber-50 text-amber-800 border-amber-300'
                                    : 'bg-white text-stone-400 border-stone-200'
                                }`}
                                title={ad.is_featured ? 'حذف نشان ویژه' : 'ویژه کردن آگهی'}
                              >
                                <Sparkles size={14} className={ad.is_featured ? 'text-amber-600' : 'text-stone-400'} />
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteAdAdmin(ad.id)}
                                className="h-9 w-9 shrink-0 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 flex items-center justify-center cursor-pointer active:scale-95"
                                title="حذف دائمی آگهی"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Desktop Table View (>= md) */}
                    <div className="hidden md:block overflow-x-auto no-scrollbar">
                    <table className="w-full text-right border-collapse">
                      <thead>
                        <tr className="bg-stone-50/90 border-b border-stone-200/80 text-[11.5px] font-bold text-stone-500 select-none">
                          <th className="py-3 px-3 text-center w-14">تصویر</th>
                          <th className="py-3 px-3 text-center w-28">کشور</th>
                          <th className="py-3 px-3 min-w-[220px]">عنوان و دسته‌بندی</th>
                          <th className="py-3 px-3 min-w-[120px]">شهر و قیمت</th>
                          <th className="py-3 px-3 text-center w-20">بازدید</th>
                          <th className="py-3 px-3 text-center w-24">وضعیت</th>
                          <th className="py-3 px-3 text-center min-w-[140px]">عملیات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100 text-xs">
                        {activeAds.map(ad => {
                          const countryObj = countriesList.find(c => c.id === (ad.country || 'se')) || countriesList[0];
                          const catObj = categoriesList.find(c => c.id === ad.category) || CATEGORIES.find(c => c.id === ad.category);

                          return (
                            <tr
                              key={ad.id}
                              id={`ad-item-${ad.id}`}
                              className="hover:bg-blue-50/40 transition-colors group"
                            >
                              {/* 1. Thumbnail */}
                              <td className="py-2.5 px-3 text-center align-middle">
                                <div 
                                  onClick={() => setSelectedAdForModal(ad)}
                                  className="w-11 h-11 rounded-xl bg-stone-100 border border-stone-200/80 overflow-hidden shrink-0 mx-auto cursor-pointer shadow-2xs"
                                  title="کلیک برای مشاهده جزئیات کامل"
                                >
                                  {ad.images && ad.images[0] ? (
                                    <img src={ad.images[0]} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-stone-300 bg-stone-50">
                                      <ImageIcon size={18} />
                                    </div>
                                  )}
                                </div>
                              </td>

                              {/* 2. Country */}
                              <td className="py-2.5 px-3 text-center align-middle">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-blue-50 text-blue-700 border border-blue-200/70 whitespace-nowrap">
                                  {renderCountryFlag(ad.country || 'se')}
                                  <span>{countryObj.nameFa}</span>
                                </span>
                              </td>

                              {/* 3. Title & Category */}
                              <td className="py-2.5 px-3 align-middle">
                                <div className="min-w-0 max-w-[280px]">
                                  <span 
                                    onClick={() => setSelectedAdForModal(ad)}
                                    className="font-extrabold text-[13px] text-stone-900 hover:text-blue-600 cursor-pointer line-clamp-1 block transition-colors leading-snug"
                                    title={ad.title}
                                  >
                                    {ad.title}
                                  </span>
                                  <div className="flex items-center gap-2 mt-1 text-[11px] text-stone-400">
                                    {catObj && (
                                      <span className="px-1.5 py-0.5 rounded bg-stone-100 text-stone-600 font-medium text-[10.5px]">
                                        {catObj.fa}
                                      </span>
                                    )}
                                    <span className="tabular-nums text-[10px]" dir="ltr">
                                      {new Date(ad.created_at || '2026-01-01').toLocaleDateString('sv-SE')}
                                    </span>
                                  </div>
                                </div>
                              </td>

                              {/* 4. City & Price */}
                              <td className="py-2.5 px-3 align-middle">
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-1 text-stone-700 font-medium text-[11.5px]">
                                    <MapPin size={12} className="text-stone-400 shrink-0" />
                                    <span>{ad.city || 'نامشخص'}</span>
                                  </div>
                                  <span className="font-extrabold text-stone-900 tabular-nums text-[12px] block">
                                    {ad.price ? `${Number(ad.price).toLocaleString('sv-SE')} ${ad.price_type === 'kr' || !ad.price_type ? 'کرون' : ad.price_type}` : 'توافقی'}
                                  </span>
                                </div>
                              </td>

                              {/* 5. Views */}
                              <td className="py-2.5 px-3 text-center align-middle">
                                <span className="inline-flex items-center gap-1 font-mono text-[11.5px] font-semibold text-stone-600 bg-stone-50 px-2 py-0.5 rounded border border-stone-200/60">
                                  <Eye size={11} className="text-stone-400" />
                                  <span>{ad.views_count || 1}</span>
                                </span>
                              </td>

                              {/* 7. Status & VIP */}
                              <td className="py-2.5 px-3 text-center align-middle">
                                <div className="space-y-1">
                                  <span className="inline-block px-2 py-0.5 rounded-full text-[10.5px] font-bold border bg-emerald-50 text-emerald-700 border-emerald-200">
                                    فعال
                                  </span>
                                  {ad.is_featured && (
                                    <span className="flex items-center justify-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[10px] font-extrabold border border-amber-300">
                                      <Sparkles size={10} className="text-amber-600" />
                                      <span>ویژه</span>
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* 8. Actions */}
                              <td className="py-2.5 px-3 text-center align-middle">
                                <div className="flex items-center justify-center gap-1">
                                  {ad.status !== 'active' && (
                                    <button
                                      type="button"
                                      onClick={() => approveAdAdmin(ad.id)}
                                      className="h-8 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors active:scale-95"
                                      title="تایید و انتشار در سایت"
                                    >
                                      <CheckCircle size={13} />
                                      <span>تایید</span>
                                    </button>
                                  )}
                                  {/* View Full Info Modal */}
                                  <button
                                    type="button"
                                    onClick={() => setSelectedAdForModal(ad)}
                                    className="h-8 px-2 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors active:scale-95"
                                    title="مشاهده جزئیات کامل و تصاویر"
                                  >
                                    <Eye size={13} className="text-stone-500" />
                                    <span>مشاهده</span>
                                  </button>

                                  {/* Toggle VIP */}
                                  <button
                                    type="button"
                                    onClick={() => toggleFeatured(ad)}
                                    className={`h-8 w-8 rounded-lg border flex items-center justify-center cursor-pointer transition-all active:scale-95 ${
                                      ad.is_featured
                                        ? 'bg-amber-50 text-amber-800 border-amber-300'
                                        : 'bg-white hover:bg-stone-50 text-stone-400 border-stone-200'
                                    }`}
                                    title={ad.is_featured ? 'حذف نشان ویژه' : 'ویژه کردن آگهی'}
                                  >
                                    <Sparkles size={13} className={ad.is_featured ? 'text-amber-600' : 'text-stone-400'} />
                                  </button>

                                  {/* Delete Ad */}
                                  <button
                                    type="button"
                                    onClick={() => deleteAdAdmin(ad.id)}
                                    className="h-8 w-8 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 flex items-center justify-center cursor-pointer transition-all active:scale-95"
                                    title="حذف دائمی آگهی"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  </>
                )}

                {/* Pagination Controls (Rule #3: 10 records per page) */}
                <PaginationBar
                  currentPage={activePage}
                  totalCount={activeTotalCount}
                  pageSize={PAGE_SIZE}
                  onPageChange={(p) => {
                    fetchActiveAds(p, searchQuery, countryFilter, categoryFilter, adStatusFilter, vipOnlyFilter);
                    if (mainScrollRef.current) {
                      mainScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                  }}
                  loading={activeLoading}
                />
              </div>

            </div>
          )}

          {/* ========================================================
              TAB: ABUSE REPORTS QUEUE
          ======================================================== */}
          {activeTab === 'reports' && (
            <div className="space-y-4 w-full">
              <div className="p-4 sm:p-5 rounded-2xl border border-stone-200/80 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center shrink-0">
                    <AlertCircle size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-extrabold text-stone-900">گزارش‌های تخلف کاربران</h3>
                    <p className="text-xs text-stone-500">بررسی و حذف سریع آگهی‌های گزارش‌شده</p>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold tabular-nums">
                  {adReports.length} گزارش
                </span>
              </div>

              {adReports.length === 0 ? (
                <div className="p-12 rounded-2xl border border-stone-200/80 bg-white text-center space-y-2">
                  <CheckCircle size={32} className="mx-auto text-emerald-500" />
                  <p className="text-sm font-bold text-stone-800">هیچ گزارش تخلفی وجود ندارد</p>
                  <p className="text-xs text-stone-500">تمامی آگهی‌های گزارش‌شده بررسی شده‌اند.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {adReports.map((rep) => (
                    <div key={rep.id} className="p-4 rounded-2xl border border-stone-200/80 bg-white shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-bold">
                            {rep.reason}
                          </span>
                          {rep.reference_number && (
                            <span className="font-mono text-[11px] font-bold text-stone-600 bg-stone-100 px-2 py-0.5 rounded-md">
                              <bdi>{rep.reference_number}</bdi>
                            </span>
                          )}
                          <span className="text-[11px] text-stone-400 font-mono">
                            {rep.created_at ? new Date(rep.created_at).toLocaleDateString('sv-SE') : ''}
                          </span>
                        </div>
                        <p className="text-sm font-bold text-stone-900 truncate">{rep.title || 'آگهی گزارش‌شده'}</p>
                        {rep.details && <p className="text-xs text-stone-600">{rep.details}</p>}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            const base = (getMainSiteUrl() || 'https://swedpersiska.vercel.app').replace(/\/+$/, '');
                            window.open(`${base}/?ad=${rep.reference_number || rep.ad_id}`, '_blank', 'noopener,noreferrer');
                          }}
                          className="h-9 px-3 rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                          <ExternalLink size={13} />
                          <span>مشاهده</span>
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await deleteAdAdmin(rep.ad_id);
                            setAdReports(prev => prev.filter(r => String(r.ad_id) !== String(rep.ad_id)));
                          }}
                          className="h-9 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                          <Trash2 size={13} />
                          <span>حذف آگهی</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => dismissReportAdmin(rep.id)}
                          className="h-9 px-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold cursor-pointer"
                        >
                          بستن گزارش
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ========================================================
              TAB: CATEGORIES & CITIES MANAGEMENT
          ======================================================== */}
          {activeTab === 'categories' && (
            <div className="space-y-4 w-full">

              {/* Sub-Navigation Pills: Categories vs Cities */}
              <div className="p-1.5 rounded-2xl border border-stone-200/80 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                <button
                  type="button"
                  onClick={() => { playFeedback('click'); setCatalogSubTab('categories'); }}
                  className={`flex-1 sm:flex-initial min-h-[38px] px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 whitespace-nowrap transition-all cursor-pointer active:scale-[0.98] ${
                    catalogSubTab === 'categories'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100/80'
                  }`}
                >
                  <Shapes size={14} className={catalogSubTab === 'categories' ? 'text-emerald-300' : 'text-stone-400'} />
                  <span>مدیریت دسته‌بندی‌ها</span>
                  <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                    catalogSubTab === 'categories' ? 'bg-white/15 text-white' : 'bg-stone-100 text-stone-600'
                  }`}>
                    {categoriesList.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => { playFeedback('click'); setCatalogSubTab('cities'); }}
                  className={`flex-1 sm:flex-initial min-h-[38px] px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 whitespace-nowrap transition-all cursor-pointer active:scale-[0.98] ${
                    catalogSubTab === 'cities'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100/80'
                  }`}
                >
                  <MapPin size={14} className={catalogSubTab === 'cities' ? 'text-blue-300' : 'text-stone-400'} />
                  <span>مدیریت شهرها</span>
                  <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                    catalogSubTab === 'cities' ? 'bg-white/15 text-white' : 'bg-stone-100 text-stone-600'
                  }`}>
                    {Object.values(citiesByCountry).reduce((acc, arr) => acc + (Array.isArray(arr) ? arr.length : 0), 0)}
                  </span>
                </button>
              </div>

              {catalogSubTab === 'categories' && (
                <>
              {/* Controls & Actions Bar */}
              <div className="p-4 rounded-2xl border border-stone-200/80 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                
                {/* Search & Status Filter */}
                <div className="flex flex-col sm:flex-row items-center gap-2.5 flex-1">
                  <div className="relative w-full sm:w-72">
                    <Search size={15} className="absolute start-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="جستجو در عنوان، شناسه یا آیکون..."
                      value={categorySearchQuery}
                      onChange={(e) => setCategorySearchQuery(e.target.value)}
                      className="w-full h-10 rounded-xl bg-stone-50 hover:bg-stone-100/70 focus:bg-white border border-stone-200/80 ps-9 pe-8 text-xs text-zinc-900 placeholder:text-stone-400 focus:border-stone-400 focus:outline-none transition-all shadow-2xs"
                    />
                    {categorySearchQuery && (
                      <button
                        type="button"
                        onClick={() => setCategorySearchQuery('')}
                        className="absolute end-2.5 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-600 rounded-md cursor-pointer"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>

                  <select
                    value={categoryStatusFilter}
                    onChange={(e) => setCategoryStatusFilter(e.target.value)}
                    className="w-full sm:w-auto h-10 rounded-xl bg-stone-50 border border-stone-200/80 px-3 text-xs font-semibold text-zinc-800 focus:bg-white focus:border-stone-400 focus:outline-none cursor-pointer shadow-2xs"
                  >
                    <option value="all">همه وضعیت‌ها ({categoriesList.length})</option>
                    <option value="active">فقط فعال ({categoriesList.filter(c => c.enabled !== false).length})</option>
                    <option value="disabled">فقط غیرفعال ({categoriesList.filter(c => c.enabled === false).length})</option>
                    <option value="has_ads">دارای آگهی ({categoriesList.filter(c => (categoryCounts[c.id] || 0) > 0).length})</option>
                  </select>
                </div>

                {/* Add New Category Primary Action */}
                <button
                  type="button"
                  onClick={handleOpenAddCategory}
                  className="h-10 px-4 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all shadow-2xs shrink-0"
                >
                  <Plus size={16} />
                  <span>افزودن دسته‌بندی جدید</span>
                </button>
              </div>

              {/* 3. High-Density Luxury Categories Table */}
              <div className="bg-white rounded-2xl border border-stone-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.03)] overflow-hidden">
                {filteredCategories.length === 0 ? (
                  <div className="text-center py-16 p-8 text-stone-400 space-y-2">
                    <FolderTree size={36} className="mx-auto text-stone-300" />
                    <p className="text-sm font-semibold text-stone-600">هیچ دسته‌بندی با این فیلترها یافت نشد.</p>
                    <p className="text-xs text-stone-400">جستجو را بازنشانی کنید یا دسته جدیدی اضافه نمایید.</p>
                  </div>
                ) : (
                  <>
                    {/* Mobile Cards View (< md) */}
                    <div className="md:hidden divide-y divide-stone-100">
                      {filteredCategories.map(cat => {
                        const IconComp = CATEGORY_ICON_MAP[cat.icon] || Tag;
                        const adCount = categoryCounts[cat.id] || 0;
                        const isEnabled = cat.enabled !== false;

                        return (
                          <div key={`m-cat-${cat.id}`} className={`p-4 space-y-3 transition-colors ${isEnabled ? 'hover:bg-blue-50/30' : 'bg-stone-50/60 opacity-85'}`}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className={`w-11 h-11 shrink-0 rounded-xl border flex items-center justify-center shadow-2xs transition-colors ${
                                  isEnabled
                                    ? 'bg-blue-50/70 border-blue-200/70 text-blue-700'
                                    : 'bg-stone-100 border-stone-200 text-stone-400'
                                }`}>
                                  <IconComp size={19} />
                                </div>
                                <div className="min-w-0">
                                  <span className="font-extrabold text-[14px] text-stone-900 block truncate">
                                    {cat.fa}
                                  </span>
                                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                    <button
                                      type="button"
                                      dir="ltr"
                                      onClick={() => copyText(cat.id, `m-cat-${cat.id}`, 'شناسه دسته')}
                                      className="font-mono text-[10.5px] font-bold text-stone-700 bg-stone-100 hover:bg-stone-200 px-2 py-0.5 rounded-md border border-stone-200/80 inline-flex items-center gap-1 cursor-pointer"
                                    >
                                      <span>#{cat.id}</span>
                                      {copiedKey === `m-cat-${cat.id}` ? <Check size={10} className="text-emerald-600" /> : <Copy size={10} className="text-stone-400" />}
                                    </button>
                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                                      cat.isSystem
                                        ? 'bg-slate-100 text-slate-600 border-slate-200/80'
                                        : 'bg-purple-50 text-purple-700 border-purple-200/80'
                                    }`}>
                                      {cat.isSystem ? 'پیش‌فرض' : 'سفارشی'}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleToggleCategoryStatus(cat.id)}
                                className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-bold border inline-flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all ${
                                  isEnabled
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-stone-100 text-stone-500 border-stone-200'
                                }`}
                              >
                                <span className={`h-1.5 w-1.5 rounded-full ${isEnabled ? 'bg-emerald-500' : 'bg-stone-400'}`} />
                                <span>{isEnabled ? 'فعال' : 'غیرفعال'}</span>
                              </button>
                            </div>

                            <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-stone-100">
                              {adCount > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => handleViewCategoryAds(cat.id)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200/70 text-[11px] font-bold cursor-pointer active:scale-95 whitespace-nowrap"
                                >
                                  <span className="font-mono">{adCount}</span>
                                  <span>آگهی</span>
                                  <ExternalLink size={11} />
                                </button>
                              ) : (
                                <span className="px-2.5 py-1 rounded-lg bg-stone-100 text-stone-400 text-[11px] font-mono whitespace-nowrap">
                                  بدون آگهی
                                </span>
                              )}

                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditCategory(cat)}
                                  className="h-8 px-3 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 text-[11px] font-bold flex items-center gap-1.5 cursor-pointer active:scale-95 whitespace-nowrap"
                                >
                                  <Edit3 size={13} />
                                  <span>ویرایش</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setCategoryToDelete(cat)}
                                  className="h-8 w-8 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 flex items-center justify-center cursor-pointer active:scale-95"
                                  title="حذف دسته‌بندی"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Desktop Table View (>= md) */}
                    <div className="hidden md:block overflow-x-auto no-scrollbar">
                    <table className="w-full text-right border-collapse">
                      <thead>
                        <tr className="bg-stone-50/90 border-b border-stone-200/80 text-[11.5px] font-bold text-stone-500 select-none">
                          <th className="py-3 px-3 text-center w-14">آیکون</th>
                          <th className="py-3 px-3 min-w-[200px]">عنوان دسته‌بندی</th>
                          <th className="py-3 px-3 min-w-[150px]">شناسه یکتا</th>
                          <th className="py-3 px-3 min-w-[130px] text-center">آگهی‌های ثبت‌شده</th>
                          <th className="py-3 px-3 text-center w-24">وضعیت</th>
                          <th className="py-3 px-3 text-center w-28">نوع دسته</th>
                          <th className="py-3 px-3 text-center min-w-[140px]">عملیات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100 text-xs">
                        {filteredCategories.map(cat => {
                          const IconComp = CATEGORY_ICON_MAP[cat.icon] || Tag;
                          const adCount = categoryCounts[cat.id] || 0;
                          const isEnabled = cat.enabled !== false;

                          return (
                            <tr
                              key={cat.id}
                              className="hover:bg-blue-50/40 transition-colors group"
                            >
                              {/* 1. Icon */}
                              <td className="py-3 px-3 text-center align-middle">
                                <div className="w-10 h-10 rounded-xl bg-stone-100 border border-stone-200/80 flex items-center justify-center text-stone-700 mx-auto shadow-2xs group-hover:scale-105 group-hover:bg-blue-50 group-hover:text-blue-700 group-hover:border-blue-200 transition-all">
                                  <IconComp size={18} />
                                </div>
                              </td>

                              {/* 2. Title */}
                              <td className="py-3 px-3 align-middle">
                                <div className="space-y-0.5">
                                  <span className="font-extrabold text-[13.5px] text-stone-900 block leading-tight">
                                    {cat.fa}
                                  </span>
                                  <span className="text-[10.5px] text-stone-400">
                                    آیکون: {AVAILABLE_CATEGORY_ICONS.find(i => i.name === cat.icon)?.label || 'عمومی و سایر'}
                                  </span>
                                </div>
                              </td>

                              {/* 3. Slug */}
                              <td className="py-3 px-3 align-middle">
                                <button
                                  type="button"
                                  onClick={() => copyText(cat.id, `cat-${cat.id}`, 'شناسه دسته')}
                                  dir="ltr"
                                  className="font-mono text-[11px] font-bold text-stone-800 bg-stone-100 hover:bg-stone-200 px-2 py-0.5 rounded border border-stone-200 inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                                  title="کپی شناسه یکتا"
                                >
                                  <span>#{cat.id}</span>
                                  {copiedKey === `cat-${cat.id}` ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} className="text-stone-400" />}
                                </button>
                              </td>

                              {/* 4. Ads Count & Link */}
                              <td className="py-3 px-3 text-center align-middle">
                                {adCount > 0 ? (
                                  <button
                                    type="button"
                                    onClick={() => handleViewCategoryAds(cat.id)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200/70 text-xs font-bold cursor-pointer transition-colors shadow-2xs active:scale-95"
                                    title="مشاهده آگهی‌های این دسته"
                                  >
                                    <span className="font-mono">{adCount}</span>
                                    <span className="text-[10.5px]">آگهی</span>
                                    <ExternalLink size={11} />
                                  </button>
                                ) : (
                                  <span className="inline-block px-2 py-0.5 rounded-lg bg-stone-100 text-stone-400 text-[11px] font-mono">
                                    بدون آگهی
                                  </span>
                                )}
                              </td>

                              {/* 5. Status Toggle */}
                              <td className="py-3 px-3 text-center align-middle">
                                <button
                                  type="button"
                                  onClick={() => handleToggleCategoryStatus(cat.id)}
                                  className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border cursor-pointer active:scale-95 transition-all ${
                                    isEnabled
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                      : 'bg-stone-100 text-stone-500 border-stone-200 hover:bg-stone-200'
                                  }`}
                                  title="کلیک برای تغییر وضعیت"
                                >
                                  {isEnabled ? 'فعال' : 'غیرفعال'}
                                </button>
                              </td>

                              {/* 6. Category Type */}
                              <td className="py-3 px-3 text-center align-middle">
                                <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                                  cat.isSystem
                                    ? 'bg-slate-100 text-slate-700 border-slate-200'
                                    : 'bg-purple-50 text-purple-700 border-purple-200/80'
                                }`}>
                                  {cat.isSystem ? 'پیش‌فرض' : 'سفارشی'}
                                </span>
                              </td>

                              {/* 7. Actions */}
                              <td className="py-3 px-3 text-center align-middle">
                                <div className="flex items-center justify-center gap-1.5">
                                  {/* Edit Button */}
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditCategory(cat)}
                                    className="h-8 px-2.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors active:scale-95"
                                    title="ویرایش دسته‌بندی"
                                  >
                                    <Edit3 size={13} />
                                    <span>ویرایش</span>
                                  </button>

                                  {/* Delete Button */}
                                  <button
                                    type="button"
                                    onClick={() => setCategoryToDelete(cat)}
                                    className="h-8 w-8 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 flex items-center justify-center cursor-pointer transition-all active:scale-95"
                                    title="حذف دسته‌بندی"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  </>
                )}
              </div>
                </>
              )}

              {/* ========================================================
                  CITY MANAGEMENT SUB-TAB
              ======================================================== */}
              {catalogSubTab === 'cities' && (
                <div className="space-y-4 animate-in fade-in duration-150 ease-out">
                  {/* Country Selector & Actions Bar */}
                  <div className="p-4 rounded-2xl border border-stone-200/80 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-3">
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                      <span className="text-xs font-bold text-stone-500 shrink-0">کشور:</span>
                      <div className="p-1 rounded-xl bg-stone-100/80 border border-stone-200/80 inline-flex items-center gap-1 flex-wrap">
                        {countriesList.map(c => {
                          const list = citiesByCountry[c.id] || (c.cities || []).filter(ct => ct.id !== 'all');
                          const isSelected = cityCountryFilter === c.id;
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => { playFeedback('select'); setCityCountryFilter(c.id); }}
                              className={`min-h-[32px] px-3 rounded-lg text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                                isSelected ? 'bg-white text-zinc-950 shadow-xs' : 'text-stone-600 hover:text-zinc-950 hover:bg-white/50'
                              }`}
                            >
                              {renderCountryFlag(c.id)}
                              <span>{c.nameFa}</span>
                              <span className={`text-[10.5px] font-mono ${isSelected ? 'text-blue-600' : 'opacity-60'}`}>
                                ({list.length})
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2.5">
                      <div className="relative flex-1">
                        <Search size={15} className="absolute start-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
                        <input
                          type="text"
                          placeholder="جستجوی نام فارسی یا لاتین شهر..."
                          value={citySearchQuery}
                          onChange={(e) => setCitySearchQuery(e.target.value)}
                          className="w-full h-10 rounded-xl bg-stone-50 hover:bg-stone-100/70 focus:bg-white border border-stone-200/80 ps-9 pe-8 text-xs text-zinc-900 placeholder:text-stone-400 focus:border-stone-400 focus:outline-none transition-all shadow-2xs"
                        />
                        {citySearchQuery && (
                          <button
                            type="button"
                            onClick={() => setCitySearchQuery('')}
                            className="absolute end-2.5 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-600 rounded-md cursor-pointer"
                          >
                            <X size={13} />
                          </button>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={handleOpenAddCity}
                        className="h-10 px-4 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all shadow-2xs shrink-0"
                      >
                        <Plus size={16} />
                        <span>افزودن شهر جدید</span>
                      </button>
                    </div>
                  </div>

                  {/* Cities List (Mobile Cards + Desktop Table) */}
                  {(() => {
                    const fallbackCountryCities = (countriesList.find(c => c.id === cityCountryFilter)?.cities || [])
                      .filter(ct => ct.id !== 'all')
                      .map(ct => ({ id: ct.id, fa: ct.fa, enabled: true, isSystem: true }));
                    const rawCountryCities = Array.isArray(citiesByCountry[cityCountryFilter]) && citiesByCountry[cityCountryFilter].length > 0
                      ? citiesByCountry[cityCountryFilter]
                      : fallbackCountryCities;
                    const currentCities = rawCountryCities.filter(city => {
                      const q = citySearchQuery.trim().toLowerCase();
                      if (!q) return true;
                      return (city.fa || '').toLowerCase().includes(q) || (city.id || '').toLowerCase().includes(q);
                    });

                    return (
                      <div className="bg-white rounded-2xl border border-stone-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.03)] overflow-hidden">
                        {currentCities.length === 0 ? (
                          <div className="text-center py-16 p-8 text-stone-400 space-y-2">
                            <MapPin size={36} className="mx-auto text-stone-300" />
                            <p className="text-sm font-semibold text-stone-600">شهری با این جستجو یافت نشد.</p>
                            <p className="text-xs text-stone-400">جستجو را پاک کنید یا شهر جدیدی اضافه نمایید.</p>
                          </div>
                        ) : (
                          <>
                            {/* Mobile Cards */}
                            <div className="md:hidden divide-y divide-stone-100">
                              {currentCities.map(city => {
                                const isEnabled = city.enabled !== false;
                                return (
                                  <div key={`m-city-${city.id}`} className={`p-4 space-y-3 transition-colors ${isEnabled ? 'hover:bg-blue-50/30' : 'bg-stone-50/60 opacity-85'}`}>
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="flex items-center gap-3 min-w-0">
                                        <div className={`w-10 h-10 shrink-0 rounded-xl border flex items-center justify-center shadow-2xs ${
                                          isEnabled ? 'bg-blue-50/70 border-blue-200/70 text-blue-700' : 'bg-stone-100 border-stone-200 text-stone-400'
                                        }`}>
                                          <MapPin size={18} />
                                        </div>
                                        <div className="min-w-0">
                                          <span className="font-extrabold text-[14px] text-stone-900 block truncate">
                                            {city.fa}
                                          </span>
                                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                            <span dir="ltr" className="font-mono text-[10.5px] font-bold text-stone-700 bg-stone-100 px-2 py-0.5 rounded-md border border-stone-200/80">
                                              {city.id}
                                            </span>
                                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                                              city.isSystem ? 'bg-slate-100 text-slate-600 border-slate-200/80' : 'bg-purple-50 text-purple-700 border-purple-200/80'
                                            }`}>
                                              {city.isSystem ? 'پیش‌فرض' : 'سفارشی'}
                                            </span>
                                          </div>
                                        </div>
                                      </div>

                                      <button
                                        type="button"
                                        onClick={() => handleToggleCityStatus(city.id)}
                                        className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-bold border inline-flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all ${
                                          isEnabled ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-stone-100 text-stone-500 border-stone-200'
                                        }`}
                                      >
                                        <span className={`h-1.5 w-1.5 rounded-full ${isEnabled ? 'bg-emerald-500' : 'bg-stone-400'}`} />
                                        <span>{isEnabled ? 'فعال' : 'غیرفعال'}</span>
                                      </button>
                                    </div>

                                    <div className="flex items-center justify-end gap-1.5 pt-2.5 border-t border-stone-100">
                                      <button
                                        type="button"
                                        onClick={() => handleOpenEditCity(city)}
                                        className="h-8 px-3 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 text-[11px] font-bold flex items-center gap-1.5 cursor-pointer active:scale-95"
                                      >
                                        <Edit3 size={13} />
                                        <span>ویرایش</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setCityToDelete(city)}
                                        className="h-8 w-8 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 flex items-center justify-center cursor-pointer active:scale-95"
                                        title="حذف شهر"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Desktop Table */}
                            <div className="hidden md:block overflow-x-auto no-scrollbar">
                              <table className="w-full text-right border-collapse">
                                <thead>
                                  <tr className="bg-stone-50/90 border-b border-stone-200/80 text-[11.5px] font-bold text-stone-500 select-none">
                                    <th className="py-3 px-3 text-center w-14">آیکون</th>
                                    <th className="py-3 px-3 min-w-[180px]">نام فارسی شهر</th>
                                    <th className="py-3 px-3 min-w-[150px]">نام لاتین</th>
                                    <th className="py-3 px-3 text-center w-24">وضعیت</th>
                                    <th className="py-3 px-3 text-center w-28">نوع</th>
                                    <th className="py-3 px-3 text-center min-w-[140px]">عملیات</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-100 text-xs">
                                  {currentCities.map(city => {
                                    const isEnabled = city.enabled !== false;
                                    return (
                                      <tr key={city.id} className="hover:bg-blue-50/40 transition-colors group">
                                        <td className="py-3 px-3 text-center align-middle">
                                          <div className="w-9 h-9 rounded-xl bg-stone-100 border border-stone-200/80 flex items-center justify-center text-stone-700 mx-auto">
                                            <MapPin size={16} />
                                          </div>
                                        </td>
                                        <td className="py-3 px-3 align-middle font-extrabold text-[13px] text-stone-900">
                                          {city.fa}
                                        </td>
                                        <td className="py-3 px-3 align-middle">
                                          <span dir="ltr" className="font-mono text-[11.5px] font-bold text-stone-700 bg-stone-100 px-2 py-0.5 rounded border border-stone-200 inline-block">
                                            {city.id}
                                          </span>
                                        </td>
                                        <td className="py-3 px-3 text-center align-middle">
                                          <button
                                            type="button"
                                            onClick={() => handleToggleCityStatus(city.id)}
                                            className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border cursor-pointer active:scale-95 transition-all ${
                                              isEnabled ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-stone-100 text-stone-500 border-stone-200'
                                            }`}
                                          >
                                            {isEnabled ? 'فعال' : 'غیرفعال'}
                                          </button>
                                        </td>
                                        <td className="py-3 px-3 text-center align-middle">
                                          <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                                            city.isSystem ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-purple-50 text-purple-700 border-purple-200/80'
                                          }`}>
                                            {city.isSystem ? 'پیش‌فرض' : 'سفارشی'}
                                          </span>
                                        </td>
                                        <td className="py-3 px-3 text-center align-middle">
                                          <div className="flex items-center justify-center gap-1.5">
                                            <button
                                              type="button"
                                              onClick={() => handleOpenEditCity(city)}
                                              className="h-8 px-2.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 text-[11px] font-bold flex items-center gap-1 cursor-pointer active:scale-95"
                                            >
                                              <Edit3 size={13} />
                                              <span>ویرایش</span>
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => setCityToDelete(city)}
                                              className="h-8 w-8 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 flex items-center justify-center cursor-pointer active:scale-95"
                                              title="حذف شهر"
                                            >
                                              <Trash2 size={13} />
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

            </div>
          )}

          {/* ========================================================
              TAB: WEBSITES & SELLER PANELS (CLOUDFLARE + D1)
          ======================================================== */}
          {activeTab === 'websites' && (
            <div className="space-y-5 w-full py-1 animate-in fade-in duration-150 ease-out">
              {/* Owner Cloudflare API Token for Website Builder */}
              <form onSubmit={saveCloudflareDeploySettings} className="rounded-2xl bg-white border border-stone-200/80 p-5 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <h3 className="text-sm font-black text-zinc-900">اتصال کلودفلر ادمین برای ساخت وب‌سایت مشتریان</h3>
                    <p className="text-xs text-stone-500 mt-0.5">
                      توکن کلودفلر خود را اینجا وارد کنید تا کاربران پس از پرداخت ۲۶۰ کرون ماهانه بدون نیاز به ورود به کلودفلر، سایتشان را بسازند.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <a
                      href="https://dash.cloudflare.com/profile/api-tokens"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-8 px-3 rounded-xl bg-[#F38020] hover:bg-[#E05D00] text-white text-[11px] font-bold inline-flex items-center gap-1.5 shadow-2xs transition-colors"
                    >
                      <span>ورود به کلودفلر و دریافت توکن</span>
                      <ExternalLink size={12} />
                    </a>
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                      cfDeploySettings.hasToken
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {cfDeploySettings.hasToken ? 'توکن ثبت شده' : 'نیاز به ثبت توکن'}
                    </span>
                  </div>
                </div>

                {cfTestStatus && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-between gap-2 flex-wrap">
                    <span>متصل به حساب: {cfTestStatus.accountName}</span>
                    {cfTestStatus.subdomain && (
                      <span className="font-mono text-[11px]" dir="ltr">*.{cfTestStatus.subdomain}.workers.dev</span>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1.5">توکن کلودفلر (API Token)</label>
                    <input
                      type="password"
                      dir="ltr"
                      value={cfDeploySettings.apiToken}
                      onChange={(e) => setCfDeploySettings(prev => ({ ...prev, apiToken: e.target.value }))}
                      placeholder={cfDeploySettings.hasToken ? 'ثبت شده (برای تغییر وارد کنید)' : 'Workers Scripts:Edit + D1:Edit'}
                      className="w-full h-10 rounded-xl bg-stone-50 hover:bg-stone-100/70 focus:bg-white border border-stone-200/80 px-3 text-xs font-mono text-left"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1.5">شناسه حساب کلودفلر (اختیاری - Account ID)</label>
                    <input
                      type="text"
                      dir="ltr"
                      value={cfDeploySettings.accountId}
                      onChange={(e) => setCfDeploySettings(prev => ({ ...prev, accountId: e.target.value }))}
                      placeholder="در صورت خالی بودن خودکار تشخیص داده می‌شود"
                      className="w-full h-10 rounded-xl bg-stone-50 hover:bg-stone-100/70 focus:bg-white border border-stone-200/80 px-3 text-xs font-mono text-left"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="submit"
                    disabled={savingSettings}
                    className="h-10 px-5 rounded-xl bg-slate-900 hover:bg-black text-white font-bold text-xs inline-flex items-center gap-2 cursor-pointer"
                  >
                    <Save size={14} />
                    <span>ذخیره توکن کلودفلر</span>
                  </button>
                  <button
                    type="button"
                    disabled={testingCf}
                    onClick={handleTestCloudflareConnection}
                    className="h-10 px-4 rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-800 font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw size={13} className={testingCf ? 'animate-spin' : ''} />
                    <span>{testingCf ? 'در حال بررسی...' : 'تست اتصال کلودفلر'}</span>
                  </button>
                </div>
              </form>

              {/* Deployed Seller Panels (Cloudflare Workers + D1 Control) */}
              <div className="rounded-2xl bg-white border border-stone-200/80 p-5 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <h3 className="text-sm font-black text-zinc-900">
                      وب‌سایت‌ها و فروشگاه‌های ساخته‌شده ({sellerDeployments.length})
                    </h3>
                    <p className="text-xs text-stone-500 mt-0.5">
                      اشتراک ماهانه ۲۶۰ کرون (اعتبار ۳۰ روزه، غیر دائمی) • مشاهده مشخصات شرکت، تمدید ماهانه و حذف از کلودفلر در صورت عدم پرداخت.
                    </p>
                  </div>
                </div>

                {sellerDeployments.length === 0 ? (
                  <div className="p-6 rounded-xl bg-stone-50 border border-stone-200/70 text-center text-xs text-stone-400">
                    هنوز هیچ وب‌سایت یا فروشگاهی توسط کاربران ساخته نشده است.
                  </div>
                ) : (
                  <div className="divide-y divide-stone-100 rounded-xl border border-stone-200/80 overflow-hidden">
                    {sellerDeployments.map((dep) => {
                      const expTime = dep.expiresAt
                        ? new Date(dep.expiresAt).getTime()
                        : (dep.createdAt ? new Date(dep.createdAt).getTime() + 30 * 24 * 60 * 60 * 1000 : Date.now());
                      const isExpired = expTime < Date.now();
                      const expLabel = new Date(expTime).toLocaleDateString('fa-IR');
                      return (
                      <div key={dep.workerName} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-stone-50/40">
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-black text-zinc-900">{dep.name}</span>
                            <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-stone-200/70 text-stone-700">{dep.storeId}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              isExpired
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}>
                              {isExpired ? `منقضی (${expLabel})` : `فعال تا ${expLabel} • ۲۶۰ کرون/ماه`}
                            </span>
                            {dep.companyNumber && (
                              <span className="text-[10.5px] font-bold text-stone-600">ثبت شرکت: <span className="font-mono">{dep.companyNumber}</span></span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 flex-wrap text-[11px] text-stone-500">
                            {dep.phone && <span dir="ltr" className="font-mono">{dep.phone}</span>}
                            {dep.email && <span dir="ltr" className="font-mono">{dep.email}</span>}
                          </div>
                          <a
                            href={dep.panelUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] font-mono text-[#0066CC] hover:underline truncate block"
                            dir="ltr"
                          >
                            {dep.panelUrl}
                          </a>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleRenewSellerDeployment(dep)}
                            className="h-8 px-3 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <span>تمدید ۳۰ روز</span>
                          </button>
                          <button
                            type="button"
                            disabled={deletingDeployment === dep.workerName}
                            onClick={() => handleDeleteSellerDeployment(dep)}
                            className="h-8 px-3 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <Trash2 size={13} />
                            <span>{deletingDeployment === dep.workerName ? 'در حال حذف...' : 'حذف از کلودفلر'}</span>
                          </button>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================
              TAB 3: SETTINGS (BRANDING, SEO & COUNTRIES, STRIPE, SECURITY)
          ======================================================== */}
          {activeTab === 'settings' && (
            <div className="space-y-4 w-full py-1">
              {/* Sub-Navigation Pills */}
              <div className="p-1.5 rounded-2xl border border-stone-200/80 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                <button
                  type="button"
                  onClick={() => { playFeedback('click'); setSettingsSubTab('general'); }}
                  className={`flex-1 sm:flex-initial min-h-[38px] px-3.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 whitespace-nowrap transition-colors cursor-pointer ${
                    settingsSubTab === 'general'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100/80'
                  }`}
                >
                  <SlidersHorizontal size={14} className={settingsSubTab === 'general' ? 'text-purple-300' : 'text-stone-400'} />
                  <span>مشخصات برند و فوتر</span>
                </button>

                <button
                  type="button"
                  onClick={() => { playFeedback('click'); setSettingsSubTab('seo'); }}
                  className={`flex-1 sm:flex-initial min-h-[38px] px-3.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 whitespace-nowrap transition-colors cursor-pointer ${
                    settingsSubTab === 'seo'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100/80'
                  }`}
                >
                  <Globe2 size={14} className={settingsSubTab === 'seo' ? 'text-blue-300' : 'text-stone-400'} />
                  <span>کشورها، پس‌زمینه و سئو</span>
                </button>

                <button
                  type="button"
                  onClick={() => { playFeedback('click'); setSettingsSubTab('monetization'); }}
                  className={`flex-1 sm:flex-initial min-h-[38px] px-3.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 whitespace-nowrap transition-colors cursor-pointer ${
                    settingsSubTab === 'monetization'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100/80'
                  }`}
                >
                  <WalletCards size={14} className={settingsSubTab === 'monetization' ? 'text-amber-300' : 'text-stone-400'} />
                  <span>درگاه پرداخت و تعرفه</span>
                  <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                    settingsSubTab === 'monetization'
                      ? 'bg-white/15 text-amber-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-200/70'
                  }`}>
                    {stripeSettings.mode === 'live' ? 'عملیاتی' : 'آزمایشی'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => { playFeedback('click'); setSettingsSubTab('security'); }}
                  className={`flex-1 sm:flex-initial min-h-[38px] px-3.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 whitespace-nowrap transition-colors cursor-pointer ${
                    settingsSubTab === 'security'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100/80'
                  }`}
                >
                  <ShieldCheck size={14} className={settingsSubTab === 'security' ? 'text-cyan-300' : 'text-stone-400'} />
                  <span>امنیت سیستم</span>
                  <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                    turnstileSettings.enabled
                      ? (settingsSubTab === 'security' ? 'bg-emerald-500/30 text-emerald-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200/70')
                      : (settingsSubTab === 'security' ? 'bg-white/15 text-stone-300' : 'bg-stone-100 text-stone-500')
                  }`}>
                    {turnstileSettings.enabled ? 'فعال' : 'غیرفعال'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => { playFeedback('click'); setSettingsSubTab('podcast'); }}
                  className={`flex-1 sm:flex-initial min-h-[38px] px-3.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 whitespace-nowrap transition-colors cursor-pointer ${
                    settingsSubTab === 'podcast'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100/80'
                  }`}
                >
                  <Headphones size={14} className={settingsSubTab === 'podcast' ? 'text-rose-300' : 'text-stone-400'} />
                  <span>پادکست خبری و یوتیوب</span>
                  <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                    podcastSettings.youtubeChannelUrl || (podcastSettings.manualVideos || []).length > 0
                      ? (settingsSubTab === 'podcast' ? 'bg-rose-500/30 text-rose-200' : 'bg-rose-50 text-rose-700 border border-rose-200/70')
                      : (settingsSubTab === 'podcast' ? 'bg-white/15 text-stone-300' : 'bg-stone-100 text-stone-500')
                  }`}>
                    {(podcastSettings.youtubeChannelUrl || (podcastSettings.manualVideos || []).length > 0) ? 'متصل' : 'خالی'}
                  </span>
                </button>
              </div>

              {settingsSubTab === 'podcast' && (
            <div className="space-y-6 w-full py-2 animate-in fade-in duration-150 ease-out">
              <div className="border-b border-stone-200/80 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-black text-zinc-900">پادکست خبری و فید یوتیوب</h2>
                  <p className="text-xs text-stone-500 mt-0.5">
                    لینک کانال یوتیوب خود را وارد کنید تا آخرین ویدیوهای خبری به‌صورت خودکار در فید پادکست خبری سایت نمایش داده شوند.
                  </p>
                </div>
                <span className={`self-start sm:self-auto px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                  podcastSettings.enabled !== false
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-stone-100 text-stone-600 border-stone-200'
                }`}>
                  {podcastSettings.enabled !== false ? 'فعال در سایت' : 'غیرفعال'}
                </span>
              </div>

              <form onSubmit={savePodcastSettings} className="space-y-5">
                <div className="rounded-2xl bg-white border border-stone-200/80 p-5 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-4">
                  <label className="flex items-center justify-between p-4 rounded-xl bg-stone-50 hover:bg-stone-100/70 border border-stone-200/80 cursor-pointer transition-all">
                    <div>
                      <span className="text-xs font-bold text-zinc-900 block">فعال‌سازی بخش پادکست خبری در سایت</span>
                      <span className="text-[11px] text-stone-500">نمایش فید خبری و پخش‌کننده یوتیوب در منوی اصلی و موبایل</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={podcastSettings.enabled !== false}
                      onChange={(e) => setPodcastSettings(prev => ({ ...prev, enabled: e.target.checked }))}
                      className="h-4 w-4 rounded text-zinc-900 focus:ring-zinc-900 cursor-pointer"
                    />
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1.5">عنوان بخش پادکست خبری</label>
                      <input
                        type="text"
                        value={podcastSettings.title || ''}
                        onChange={(e) => setPodcastSettings(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="پادکست خبری لینک شو"
                        className="w-full h-10 rounded-xl bg-stone-50 hover:bg-stone-100/70 focus:bg-white border border-stone-200/80 px-3 text-xs text-zinc-900 focus:border-stone-400 focus:outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1.5">توضیح کوتاه (زیرعنوان)</label>
                      <input
                        type="text"
                        value={podcastSettings.subtitle || ''}
                        onChange={(e) => setPodcastSettings(prev => ({ ...prev, subtitle: e.target.value }))}
                        placeholder="تازه‌ترین گزارش‌ها و پادکست‌های خبری فارسی‌زبانان اروپا"
                        className="w-full h-10 rounded-xl bg-stone-50 hover:bg-stone-100/70 focus:bg-white border border-stone-200/80 px-3 text-xs text-zinc-900 focus:border-stone-400 focus:outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1.5">
                        لینک کانال یوتیوب (YouTube Channel URL)
                      </label>
                      <input
                        type="url"
                        dir="ltr"
                        value={podcastSettings.youtubeChannelUrl || ''}
                        onChange={(e) => setPodcastSettings(prev => ({ ...prev, youtubeChannelUrl: e.target.value }))}
                        placeholder="https://www.youtube.com/@YourChannel"
                        className="w-full h-10 rounded-xl bg-stone-50 hover:bg-stone-100/70 focus:bg-white border border-stone-200/80 px-3 text-xs text-zinc-900 font-mono focus:border-stone-400 focus:outline-none transition-all text-left"
                      />
                      <p className="text-[10.5px] text-stone-400 mt-1">
                        لینک @handle یا لینک مستقیم /channel/UC... را وارد کنید تا فید ویدیوها خودکار خوانده شود.
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1.5">
                        شناسه کانال یوتیوب (اختیاری - Channel ID)
                      </label>
                      <input
                        type="text"
                        dir="ltr"
                        value={podcastSettings.youtubeChannelId || ''}
                        onChange={(e) => setPodcastSettings(prev => ({ ...prev, youtubeChannelId: e.target.value }))}
                        placeholder="UCxxxxxxxxxxxxxxxxxxxxxx"
                        className="w-full h-10 rounded-xl bg-stone-50 hover:bg-stone-100/70 focus:bg-white border border-stone-200/80 px-3 text-xs text-zinc-900 font-mono focus:border-stone-400 focus:outline-none transition-all text-left"
                      />
                      <p className="text-[10.5px] text-stone-400 mt-1">
                        در صورت خالی بودن، سیستم به‌صورت خودکار از لینک کانال استخراج می‌کند.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Optional Manual / Pinned YouTube Episodes */}
                <div className="rounded-2xl bg-white border border-stone-200/80 p-5 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-4">
                  <div>
                    <h3 className="text-xs font-extrabold text-zinc-900">افزودن دستی ویدیو / قسمت ویژه به فید (اختیاری)</h3>
                    <p className="text-[11px] text-stone-500 mt-0.5">
                      علاوه بر ویدیوهای خودکار کانال، می‌توانید لینک تکی ویدیوهای یوتیوب را هم اینجا پین کنید.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={newPodcastVideoTitle}
                      onChange={(e) => setNewPodcastVideoTitle(e.target.value)}
                      placeholder="عنوان قسمت (اختیاری)"
                      className="sm:w-56 h-10 rounded-xl bg-stone-50 border border-stone-200/80 px-3 text-xs text-zinc-900 focus:bg-white focus:border-stone-400 focus:outline-none"
                    />
                    <input
                      type="url"
                      dir="ltr"
                      value={newPodcastVideoUrl}
                      onChange={(e) => setNewPodcastVideoUrl(e.target.value)}
                      placeholder="https://www.youtube.com/watch?v=..."
                      className="flex-1 h-10 rounded-xl bg-stone-50 border border-stone-200/80 px-3 text-xs text-zinc-900 font-mono focus:bg-white focus:border-stone-400 focus:outline-none text-left"
                    />
                    <button
                      type="button"
                      onClick={handleAddManualPodcastVideo}
                      className="h-10 px-4 rounded-xl bg-[#0066CC] hover:bg-[#0055AA] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                    >
                      <Plus size={14} />
                      <span>افزودن ویدیو</span>
                    </button>
                  </div>

                  {(podcastSettings.manualVideos || []).length > 0 && (
                    <div className="divide-y divide-stone-100 rounded-xl border border-stone-200/80 overflow-hidden">
                      {(podcastSettings.manualVideos || []).map((v) => (
                        <div key={v.videoId} className="p-2.5 flex items-center justify-between gap-3 bg-stone-50/50">
                          <div className="flex items-center gap-3 min-w-0">
                            <img
                              src={`https://i.ytimg.com/vi/${v.videoId}/mqdefault.jpg`}
                              alt=""
                              className="w-16 h-10 rounded-lg object-cover border border-stone-200 shrink-0"
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-zinc-900 truncate">{v.title}</p>
                              <p className="text-[10.5px] font-mono text-stone-400 truncate" dir="ltr">{v.url}</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setPodcastSettings(prev => ({
                              ...prev,
                              manualVideos: (prev.manualVideos || []).filter(item => item.videoId !== v.videoId)
                            }))}
                            className="h-8 w-8 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 cursor-pointer"
                            title="حذف ویدیو"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={savingSettings}
                  className="h-10 px-6 rounded-xl bg-slate-900 hover:bg-black disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 shadow-2xs active:scale-[0.98] transition-all cursor-pointer"
                >
                  <Save size={15} />
                  <span>{savingSettings ? 'در حال ذخیره‌سازی...' : 'ذخیره تنظیمات پادکست خبری'}</span>
                </button>
              </form>
            </div>
              )}

              {settingsSubTab === 'monetization' && (
            <div className="space-y-6 w-full py-2 animate-in fade-in duration-150 ease-out">
              
              <div className="border-b border-stone-200/80 pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-black text-zinc-900">درگاه پرداخت و تعرفه‌ها</h2>
                  <p className="text-xs text-stone-500 mt-0.5">تنظیمات پرداخت و ارتقای آگهی</p>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                    stripeSettings.mode === 'live' 
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80' 
                      : 'bg-amber-50 text-amber-800 border-amber-200/80'
                  }`}>
                    {stripeSettings.mode === 'live' ? 'عملیاتی' : 'آزمایشی'}
                  </span>
                </div>
              </div>

              {saveSuccessMsg && (
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-xs font-bold flex items-center gap-2">
                  <CheckCircle size={16} className="text-emerald-600" />
                  <span>{saveSuccessMsg}</span>
                </div>
              )}

              <form onSubmit={saveStripeSettings} className="space-y-6">
                
                {/* Stripe Credentials Card */}
                <div className="rounded-2xl bg-white border border-stone-200/80 p-5 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-4">
                  <h3 className="text-xs font-extrabold text-zinc-900">اطلاعات درگاه پرداخت اینترنتی</h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1.5">حالت درگاه</label>
                      <select
                        value={stripeSettings.mode}
                        onChange={(e) => setStripeSettings(prev => ({ ...prev, mode: e.target.value }))}
                        className="w-full h-10 rounded-xl bg-stone-50 hover:bg-stone-100/70 focus:bg-white border border-stone-200/80 px-3 text-xs text-zinc-900 font-medium focus:border-stone-400 focus:outline-none transition-all cursor-pointer shadow-2xs"
                      >
                        <option value="test">آزمایشی</option>
                        <option value="live">عملیاتی و واقعی</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1.5">وضعیت درگاه</label>
                      <select
                        value={stripeSettings.enabled ? 'true' : 'false'}
                        onChange={(e) => setStripeSettings(prev => ({ ...prev, enabled: e.target.value === 'true' }))}
                        className="w-full h-10 rounded-xl bg-stone-50 hover:bg-stone-100/70 focus:bg-white border border-stone-200/80 px-3 text-xs text-zinc-900 font-medium focus:border-stone-400 focus:outline-none transition-all cursor-pointer shadow-2xs"
                      >
                        <option value="true">فعال</option>
                        <option value="false">غیرفعال</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-3 pt-1">
                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1.5">کلید عمومی درگاه پرداخت</label>
                      <input
                        type="text"
                        value={stripeSettings.publishableKey}
                        onChange={(e) => setStripeSettings(prev => ({ ...prev, publishableKey: e.target.value }))}
                        placeholder="کلید عمومی آزمایشی یا عملیاتی"
                        className="w-full h-10 rounded-xl bg-stone-50 hover:bg-stone-100/70 focus:bg-white border border-stone-200/80 px-3.5 text-xs text-zinc-900 font-mono focus:border-stone-400 focus:outline-none transition-all shadow-2xs"
                        dir="ltr"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1.5">کلید محرمانه درگاه پرداخت</label>
                      <input
                        type="password"
                        value={stripeSettings.secretKey}
                        onChange={(e) => setStripeSettings(prev => ({ ...prev, secretKey: e.target.value }))}
                        placeholder="کلید محرمانه آزمایشی یا عملیاتی"
                        className="w-full h-10 rounded-xl bg-stone-50 hover:bg-stone-100/70 focus:bg-white border border-stone-200/80 px-3.5 text-xs text-zinc-900 font-mono focus:border-stone-400 focus:outline-none transition-all shadow-2xs"
                        dir="ltr"
                      />
                    </div>
                  </div>
                </div>

                {/* Pricing & VIP Configuration */}
                <div className="rounded-2xl bg-white border border-stone-200/80 p-5 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-4">
                  <h3 className="text-xs font-extrabold text-zinc-900">تعرفه آگهی ویژه</h3>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1.5">مبلغ</label>
                      <input
                        type="number"
                        min="1"
                        value={stripeSettings.vipPrice}
                        onChange={(e) => setStripeSettings(prev => ({ ...prev, vipPrice: Number(e.target.value) }))}
                        className="w-full h-10 rounded-xl bg-stone-50 hover:bg-stone-100/70 focus:bg-white border border-stone-200/80 px-3.5 text-xs text-zinc-900 font-mono focus:border-stone-400 focus:outline-none transition-all shadow-2xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1.5">واحد پول</label>
                      <select
                        value={stripeSettings.currency}
                        onChange={(e) => setStripeSettings(prev => ({ ...prev, currency: e.target.value }))}
                        className="w-full h-10 rounded-xl bg-stone-50 hover:bg-stone-100/70 focus:bg-white border border-stone-200/80 px-3 text-xs text-zinc-900 font-medium focus:border-stone-400 focus:outline-none transition-all cursor-pointer shadow-2xs"
                      >
                        <option value="SEK">کرون سوئد (SEK)</option>
                        <option value="NOK">کرون نروژ (NOK)</option>
                        <option value="DKK">کرون دانمارک (DKK)</option>
                        <option value="EUR">یورو اروپا (EUR)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1.5">مدت اعتبار</label>
                      <select
                        value={stripeSettings.vipDurationDays}
                        onChange={(e) => setStripeSettings(prev => ({ ...prev, vipDurationDays: Number(e.target.value) }))}
                        className="w-full h-10 rounded-xl bg-stone-50 hover:bg-stone-100/70 focus:bg-white border border-stone-200/80 px-3 text-xs text-zinc-900 font-medium focus:border-stone-400 focus:outline-none transition-all cursor-pointer shadow-2xs"
                      >
                        <option value={7}>۷ روز</option>
                        <option value={14}>۱۴ روز</option>
                        <option value={30}>۳۰ روز</option>
                        <option value={60}>۶۰ روز</option>
                      </select>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={savingSettings}
                  className="h-10 px-6 rounded-xl bg-slate-900 hover:bg-black disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 shadow-2xs active:scale-[0.98] transition-all cursor-pointer"
                >
                  <Save size={15} />
                  <span>{savingSettings ? 'در حال ذخیره‌سازی...' : 'ذخیره تنظیمات'}</span>
                </button>
              </form>

              {/* Owner Cloudflare API Token for Website Builder */}
              <form onSubmit={saveCloudflareDeploySettings} className="rounded-2xl bg-white border border-stone-200/80 p-5 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <h3 className="text-xs font-extrabold text-zinc-900">اتصال کلودفلر ادمین برای ساخت وب‌سایت مشتریان</h3>
                    <p className="text-[11px] text-stone-500 mt-0.5">
                      توکن کلودفلر خود را اینجا وارد کنید تا کاربران پس از پرداخت ۲۴۰ کرون بدون نیاز به ورود به کلودفلر، سایتشان را بسازند.
                    </p>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                    cfDeploySettings.hasToken
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    {cfDeploySettings.hasToken ? 'توکن ثبت شده' : 'نیاز به ثبت توکن'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1.5">توکن کلودفلر (API Token)</label>
                    <input
                      type="password"
                      dir="ltr"
                      value={cfDeploySettings.apiToken}
                      onChange={(e) => setCfDeploySettings(prev => ({ ...prev, apiToken: e.target.value }))}
                      placeholder={cfDeploySettings.hasToken ? 'ثبت شده (برای تغییر وارد کنید)' : 'Workers Scripts:Edit + D1:Edit'}
                      className="w-full h-10 rounded-xl bg-stone-50 hover:bg-stone-100/70 focus:bg-white border border-stone-200/80 px-3 text-xs font-mono text-left"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1.5">شناسه حساب کلودفلر (اختیاری - Account ID)</label>
                    <input
                      type="text"
                      dir="ltr"
                      value={cfDeploySettings.accountId}
                      onChange={(e) => setCfDeploySettings(prev => ({ ...prev, accountId: e.target.value }))}
                      placeholder="در صورت خالی بودن خودکار تشخیص داده می‌شود"
                      className="w-full h-10 rounded-xl bg-stone-50 hover:bg-stone-100/70 focus:bg-white border border-stone-200/80 px-3 text-xs font-mono text-left"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={savingSettings}
                  className="h-9 px-5 rounded-xl bg-slate-900 hover:bg-black text-white font-bold text-xs inline-flex items-center gap-2 cursor-pointer"
                >
                  <Save size={14} />
                  <span>ذخیره توکن کلودفلر</span>
                </button>
              </form>

              {/* Deployed Seller Panels (Cloudflare Workers + D1 Control) */}
              <div className="rounded-2xl bg-white border border-stone-200/80 p-5 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <h3 className="text-xs font-extrabold text-zinc-900">
                      وب‌سایت‌ها و فروشگاه‌های ساخته‌شده ({sellerDeployments.length})
                    </h3>
                    <p className="text-[11px] text-stone-500 mt-0.5">
                      اشتراک ۲۴۰ کرون ماهانه • مشاهده مشخصات شرکت و حذف سایت از کلودفلر در صورت عدم پرداخت.
                    </p>
                  </div>
                </div>

                {sellerDeployments.length === 0 ? (
                  <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/70 text-center text-xs text-stone-400">
                    هنوز هیچ وب‌سایت یا فروشگاهی توسط کاربران ساخته نشده است.
                  </div>
                ) : (
                  <div className="divide-y divide-stone-100 rounded-xl border border-stone-200/80 overflow-hidden">
                    {sellerDeployments.map((dep) => (
                      <div key={dep.workerName} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-stone-50/40">
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-black text-zinc-900">{dep.name}</span>
                            <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-stone-200/70 text-stone-700">{dep.storeId}</span>
                            {dep.companyNumber && (
                              <span className="text-[10.5px] font-bold text-stone-600">ثبت شرکت: <span className="font-mono">{dep.companyNumber}</span></span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 flex-wrap text-[11px] text-stone-500">
                            {dep.phone && <span dir="ltr" className="font-mono">{dep.phone}</span>}
                            {dep.email && <span dir="ltr" className="font-mono">{dep.email}</span>}
                          </div>
                          <a
                            href={dep.panelUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] font-mono text-[#0066CC] hover:underline truncate block"
                            dir="ltr"
                          >
                            {dep.panelUrl}
                          </a>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            disabled={deletingDeployment === dep.workerName}
                            onClick={() => handleDeleteSellerDeployment(dep)}
                            className="h-8 px-3 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <Trash2 size={13} />
                            <span>{deletingDeployment === dep.workerName ? 'در حال حذف...' : 'حذف از کلودفلر'}</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
              )}

              {settingsSubTab === 'security' && (
            <div className="space-y-6 w-full py-2 animate-in fade-in duration-150 ease-out">
              
              <div className="border-b border-stone-200/80 pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-black text-zinc-900">امنیت و آنتی‌بات</h2>
                  <p className="text-xs text-stone-500 mt-0.5">تنظیمات سپر امنیتی ضدبات</p>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                    turnstileSettings.enabled 
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80' 
                      : 'bg-rose-50 text-rose-700 border-rose-200/80'
                  }`}>
                    {turnstileSettings.enabled ? 'فعال' : 'خاموش'}
                  </span>
                </div>
              </div>

              {saveSuccessMsg && (
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-xs font-bold flex items-center gap-2">
                  <CheckCircle size={16} className="text-emerald-600" />
                  <span>{saveSuccessMsg}</span>
                </div>
              )}

              <form onSubmit={saveTurnstileSettings} className="space-y-6">
                
                {/* Toggles & Modes Card */}
                <div className="rounded-2xl bg-white border border-stone-200/80 p-5 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-4">
                  <h3 className="text-xs font-extrabold text-zinc-900">محدوده فعال‌سازی</h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label className="flex items-center justify-between p-4 rounded-xl bg-stone-50 hover:bg-stone-100/70 border border-stone-200/80 cursor-pointer transition-all shadow-2xs">
                      <div>
                        <span className="text-xs font-bold text-zinc-900 block">فعال‌بودن سپر ضدبات</span>
                        <span className="text-[11px] text-stone-500">بررسی امنیتی فرم‌ها</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={turnstileSettings.enabled}
                        onChange={(e) => setTurnstileSettings(prev => ({ ...prev, enabled: e.target.checked }))}
                        className="h-4 w-4 rounded text-zinc-900 focus:ring-zinc-900 cursor-pointer"
                      />
                    </label>

                    <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/80 space-y-1 shadow-2xs">
                      <label className="block text-xs font-bold text-stone-700">حالت اجرا</label>
                      <select
                        value={turnstileSettings.mode}
                        onChange={(e) => setTurnstileSettings(prev => ({ ...prev, mode: e.target.value }))}
                        className="w-full h-8 rounded-lg bg-white border border-stone-200/80 px-2.5 text-xs text-zinc-900 font-medium focus:border-stone-400 focus:outline-none transition-all cursor-pointer"
                      >
                        <option value="test">آزمایشی</option>
                        <option value="live">عملیاتی و واقعی</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    <label className="flex items-center justify-between p-4 rounded-xl bg-stone-50 hover:bg-stone-100/70 border border-stone-200/80 cursor-pointer transition-all shadow-2xs">
                      <div className="flex items-center gap-2.5">
                        <Lock size={15} className="text-amber-600" />
                        <div>
                          <span className="text-xs font-bold text-zinc-900 block">ورود مدیریت</span>
                          <span className="text-[11px] text-stone-500">ضد ربات</span>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={turnstileSettings.protectAdminLogin}
                        onChange={(e) => setTurnstileSettings(prev => ({ ...prev, protectAdminLogin: e.target.checked }))}
                        className="h-4 w-4 rounded text-zinc-900 focus:ring-zinc-900 cursor-pointer"
                      />
                    </label>

                    <label className="flex items-center justify-between p-4 rounded-xl bg-stone-50 hover:bg-stone-100/70 border border-stone-200/80 cursor-pointer transition-all shadow-2xs">
                      <div className="flex items-center gap-2.5">
                        <Bot size={15} className="text-zinc-700" />
                        <div>
                          <span className="text-xs font-bold text-zinc-900 block">ثبت آگهی</span>
                          <span className="text-[11px] text-stone-500">ضد اسپم</span>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={turnstileSettings.protectPostAd}
                        onChange={(e) => setTurnstileSettings(prev => ({ ...prev, protectPostAd: e.target.checked }))}
                        className="h-4 w-4 rounded text-zinc-900 focus:ring-zinc-900 cursor-pointer"
                      />
                    </label>
                  </div>
                </div>

                {/* Cloudflare Keys Card */}
                <div className="rounded-2xl bg-white border border-stone-200/80 p-5 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-extrabold text-zinc-900">کلیدهای اختصاصی ضدبات</h3>
                    <a
                      href="https://dash.cloudflare.com/?to=/:account/turnstile"
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-bold text-blue-600 hover:underline"
                    >
                      دریافت کلید ↗
                    </a>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1.5">کلید عمومی سایت</label>
                      <input
                        type="text"
                        value={turnstileSettings.siteKey}
                        onChange={(e) => setTurnstileSettings(prev => ({ ...prev, siteKey: e.target.value }))}
                        placeholder={turnstileSettings.mode === 'test' ? 'حالت آزمایشی نیازی به کلید ندارد' : 'کلید عمومی را وارد کنید'}
                        className="w-full h-10 rounded-xl bg-stone-50 hover:bg-stone-100/70 focus:bg-white border border-stone-200/80 px-3.5 text-xs text-zinc-900 font-mono focus:border-stone-400 focus:outline-none transition-all shadow-2xs"
                        dir="ltr"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1.5">کلید محرمانه سیستم</label>
                      <input
                        type="password"
                        value={turnstileSettings.secretKey}
                        onChange={(e) => setTurnstileSettings(prev => ({ ...prev, secretKey: e.target.value }))}
                        placeholder={turnstileSettings.mode === 'test' ? 'حالت آزمایشی نیازی به کلید ندارد' : 'کلید محرمانه را وارد کنید'}
                        className="w-full h-10 rounded-xl bg-stone-50 hover:bg-stone-100/70 focus:bg-white border border-stone-200/80 px-3.5 text-xs text-zinc-900 font-mono focus:border-stone-400 focus:outline-none transition-all shadow-2xs"
                        dir="ltr"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={savingSettings}
                  className="h-10 px-6 rounded-xl bg-slate-900 hover:bg-black disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 shadow-2xs active:scale-[0.98] transition-all cursor-pointer"
                >
                  <Save size={15} />
                  <span>{savingSettings ? 'در حال ذخیره‌سازی...' : 'ذخیره تنظیمات'}</span>
                </button>
              </form>

              {/* Owner Cloudflare API Token for Website Builder */}
              <form onSubmit={saveCloudflareDeploySettings} className="rounded-2xl bg-white border border-stone-200/80 p-5 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <h3 className="text-xs font-extrabold text-zinc-900">اتصال کلودفلر ادمین برای ساخت وب‌سایت مشتریان</h3>
                    <p className="text-[11px] text-stone-500 mt-0.5">
                      توکن کلودفلر خود را اینجا وارد کنید تا کاربران پس از پرداخت ۲۴۰ کرون بدون نیاز به ورود به کلودفلر، سایتشان را بسازند.
                    </p>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                    cfDeploySettings.hasToken
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    {cfDeploySettings.hasToken ? 'توکن ثبت شده' : 'نیاز به ثبت توکن'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1.5">توکن کلودفلر (API Token)</label>
                    <input
                      type="password"
                      dir="ltr"
                      value={cfDeploySettings.apiToken}
                      onChange={(e) => setCfDeploySettings(prev => ({ ...prev, apiToken: e.target.value }))}
                      placeholder={cfDeploySettings.hasToken ? 'ثبت شده (برای تغییر وارد کنید)' : 'Workers Scripts:Edit + D1:Edit'}
                      className="w-full h-10 rounded-xl bg-stone-50 hover:bg-stone-100/70 focus:bg-white border border-stone-200/80 px-3 text-xs font-mono text-left"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1.5">شناسه حساب کلودفلر (اختیاری - Account ID)</label>
                    <input
                      type="text"
                      dir="ltr"
                      value={cfDeploySettings.accountId}
                      onChange={(e) => setCfDeploySettings(prev => ({ ...prev, accountId: e.target.value }))}
                      placeholder="در صورت خالی بودن خودکار تشخیص داده می‌شود"
                      className="w-full h-10 rounded-xl bg-stone-50 hover:bg-stone-100/70 focus:bg-white border border-stone-200/80 px-3 text-xs font-mono text-left"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={savingSettings}
                  className="h-9 px-5 rounded-xl bg-slate-900 hover:bg-black text-white font-bold text-xs inline-flex items-center gap-2 cursor-pointer"
                >
                  <Save size={14} />
                  <span>ذخیره توکن کلودفلر</span>
                </button>
              </form>

              {/* Deployed Seller Panels (Cloudflare Workers + D1 Control) */}
              <div className="rounded-2xl bg-white border border-stone-200/80 p-5 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <h3 className="text-xs font-extrabold text-zinc-900">
                      وب‌سایت‌ها و فروشگاه‌های ساخته‌شده ({sellerDeployments.length})
                    </h3>
                    <p className="text-[11px] text-stone-500 mt-0.5">
                      اشتراک ۲۴۰ کرون ماهانه • مشاهده مشخصات شرکت و حذف سایت از کلودفلر در صورت عدم پرداخت.
                    </p>
                  </div>
                </div>

                {sellerDeployments.length === 0 ? (
                  <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/70 text-center text-xs text-stone-400">
                    هنوز هیچ وب‌سایت یا فروشگاهی توسط کاربران ساخته نشده است.
                  </div>
                ) : (
                  <div className="divide-y divide-stone-100 rounded-xl border border-stone-200/80 overflow-hidden">
                    {sellerDeployments.map((dep) => (
                      <div key={dep.workerName} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-stone-50/40">
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-black text-zinc-900">{dep.name}</span>
                            <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-stone-200/70 text-stone-700">{dep.storeId}</span>
                            {dep.companyNumber && (
                              <span className="text-[10.5px] font-bold text-stone-600">ثبت شرکت: <span className="font-mono">{dep.companyNumber}</span></span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 flex-wrap text-[11px] text-stone-500">
                            {dep.phone && <span dir="ltr" className="font-mono">{dep.phone}</span>}
                            {dep.email && <span dir="ltr" className="font-mono">{dep.email}</span>}
                          </div>
                          <a
                            href={dep.panelUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] font-mono text-[#0066CC] hover:underline truncate block"
                            dir="ltr"
                          >
                            {dep.panelUrl}
                          </a>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            disabled={deletingDeployment === dep.workerName}
                            onClick={() => handleDeleteSellerDeployment(dep)}
                            className="h-8 px-3 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <Trash2 size={13} />
                            <span>{deletingDeployment === dep.workerName ? 'در حال حذف...' : 'حذف از کلودفلر'}</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
              )}

              {settingsSubTab === 'general' && (
            <div className="space-y-6 w-full py-2 animate-in fade-in duration-150 ease-out">
              
              <div className="border-b border-stone-200/80 pb-4">
                <h2 className="text-base font-black text-zinc-900">مشخصات برند، تماس و شبکه‌های اجتماعی</h2>
                <p className="text-xs text-stone-500 mt-0.5">نام سایت، لوگو، اطلاعات پشتیبانی و لینک شبکه‌های اجتماعی فوتر</p>
              </div>

              {saveSuccessMsg && (
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-xs font-bold flex items-center gap-2">
                  <CheckCircle size={16} className="text-emerald-600" />
                  <span>{saveSuccessMsg}</span>
                </div>
              )}

              {/* Site Branding Form */}
              <form onSubmit={saveBrandingSettings} className="rounded-2xl bg-white border border-stone-200/80 p-5 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-4">
                <h3 className="text-xs font-extrabold text-zinc-900">مشخصات سایت</h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1.5">نام سایت</label>
                    <input
                      type="text"
                      value={siteName}
                      onChange={(e) => setSiteName(e.target.value)}
                      className="w-full h-10 rounded-xl bg-stone-50 hover:bg-stone-100/70 focus:bg-white border border-stone-200/80 px-3 text-xs text-zinc-900 focus:border-stone-400 focus:outline-none transition-all shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1.5">شعار</label>
                    <input
                      type="text"
                      value={siteSlogan}
                      onChange={(e) => setSiteSlogan(e.target.value)}
                      className="w-full h-10 rounded-xl bg-stone-50 hover:bg-stone-100/70 focus:bg-white border border-stone-200/80 px-3 text-xs text-zinc-900 focus:border-stone-400 focus:outline-none transition-all shadow-2xs"
                    />
                  </div>
                </div>

                {/* Logo & Favicon Upload + URL Inputs with Live Preview */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-stone-700">
                      لوگو سایت (آپلود مستقیم یا لینک)
                    </label>
                    <div className="flex items-center gap-2">
                      <label className="h-10 px-3.5 rounded-xl bg-[#0066CC] hover:bg-[#0055AA] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors active:scale-95">
                        <Plus size={14} />
                        <span>{uploadingBrandKey === 'logo' ? 'در حال آپلود...' : 'آپلود لوگو'}</span>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/svg+xml,.svg"
                          disabled={uploadingBrandKey !== null}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            e.target.value = '';
                            handleBrandingFileUpload(f, 'logo');
                          }}
                          className="hidden"
                        />
                      </label>
                      <input
                        type="url"
                        value={logoUrl}
                        onChange={(e) => setLogoUrl(e.target.value)}
                        placeholder="https://.../logo.png"
                        className="flex-1 min-w-0 h-10 rounded-xl bg-stone-50 hover:bg-stone-100/70 focus:bg-white border border-stone-200/80 px-3 text-xs text-zinc-900 font-mono focus:border-stone-400 focus:outline-none transition-all shadow-2xs text-left"
                        dir="ltr"
                      />
                      {logoUrl && (
                        <div className="relative shrink-0">
                          <img
                            src={logoUrl}
                            alt="پیش‌نمایش لوگو"
                            className="h-10 w-10 rounded-xl object-contain border border-stone-200 bg-stone-50 p-1"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                          <button
                            type="button"
                            onClick={() => setLogoUrl('')}
                            className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-rose-600 text-white flex items-center justify-center cursor-pointer"
                            title="حذف لوگو"
                          >
                            <X size={10} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-stone-700">
                      آیکون تب مرورگر / Favicon (آپلود مستقیم یا لینک)
                    </label>
                    <div className="flex items-center gap-2">
                      <label className="h-10 px-3.5 rounded-xl bg-[#0066CC] hover:bg-[#0055AA] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors active:scale-95">
                        <Plus size={14} />
                        <span>{uploadingBrandKey === 'favicon' ? 'در حال آپلود...' : 'آپلود آیکون'}</span>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon,.ico,.svg"
                          disabled={uploadingBrandKey !== null}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            e.target.value = '';
                            handleBrandingFileUpload(f, 'favicon');
                          }}
                          className="hidden"
                        />
                      </label>
                      <input
                        type="url"
                        value={faviconUrl}
                        onChange={(e) => setFaviconUrl(e.target.value)}
                        placeholder="https://.../favicon.png"
                        className="flex-1 min-w-0 h-10 rounded-xl bg-stone-50 hover:bg-stone-100/70 focus:bg-white border border-stone-200/80 px-3 text-xs text-zinc-900 font-mono focus:border-stone-400 focus:outline-none transition-all shadow-2xs text-left"
                        dir="ltr"
                      />
                      {faviconUrl && (
                        <div className="relative shrink-0">
                          <img
                            src={faviconUrl}
                            alt="پیش‌نمایش آیکون"
                            className="h-10 w-10 rounded-xl object-contain border border-stone-200 bg-stone-50 p-1.5"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                          <button
                            type="button"
                            onClick={() => setFaviconUrl('')}
                            className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-rose-600 text-white flex items-center justify-center cursor-pointer"
                            title="حذف آیکون"
                          >
                            <X size={10} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1.5">ایمیل</label>
                    <input
                      type="email"
                      value={supportEmail}
                      onChange={(e) => setSupportEmail(e.target.value)}
                      className="w-full h-10 rounded-xl bg-stone-50 hover:bg-stone-100/70 focus:bg-white border border-stone-200/80 px-3 text-xs text-zinc-900 font-mono focus:border-stone-400 focus:outline-none transition-all shadow-2xs text-left"
                      dir="ltr"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1.5">تلگرام</label>
                    <input
                      type="text"
                      value={supportTelegram}
                      onChange={(e) => setSupportTelegram(e.target.value)}
                      className="w-full h-10 rounded-xl bg-stone-50 hover:bg-stone-100/70 focus:bg-white border border-stone-200/80 px-3 text-xs text-zinc-900 font-mono focus:border-stone-400 focus:outline-none transition-all shadow-2xs text-left"
                      dir="ltr"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1.5">تلفن</label>
                    <input
                      type="text"
                      value={supportPhone}
                      onChange={(e) => setSupportPhone(e.target.value)}
                      placeholder="+46..."
                      className="w-full h-10 rounded-xl bg-stone-50 hover:bg-stone-100/70 focus:bg-white border border-stone-200/80 px-3 text-xs text-zinc-900 font-mono focus:border-stone-400 focus:outline-none transition-all shadow-2xs text-left"
                      dir="ltr"
                    />
                  </div>
                </div>

                {/* Footer Social Media Links (Displayed under Footer Logo) */}
                <div className="pt-4 border-t border-stone-200/80 space-y-3">
                  <div>
                    <h4 className="text-xs font-extrabold text-zinc-900">شبکه‌های اجتماعی فوتر (نمایش زیر لوگوی فوتر)</h4>
                    <p className="text-[11px] text-stone-500 mt-0.5">
                      هر شبکه‌ای را که پر کنید، آیکون آن زیر لوگو در فوتر سایت نمایش داده می‌شود (برای مخفی کردن، فیلد را خالی بگذارید).
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">اینستاگرام (Instagram)</label>
                      <input
                        type="text"
                        value={socialInstagram}
                        onChange={(e) => setSocialInstagram(e.target.value)}
                        placeholder="https://instagram.com/..."
                        className="w-full h-10 rounded-xl bg-stone-50 hover:bg-stone-100/70 focus:bg-white border border-stone-200/80 px-3 text-xs text-zinc-900 font-mono focus:border-stone-400 focus:outline-none transition-all text-left"
                        dir="ltr"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">تلگرام (Telegram)</label>
                      <input
                        type="text"
                        value={socialTelegram}
                        onChange={(e) => setSocialTelegram(e.target.value)}
                        placeholder="https://t.me/..."
                        className="w-full h-10 rounded-xl bg-stone-50 hover:bg-stone-100/70 focus:bg-white border border-stone-200/80 px-3 text-xs text-zinc-900 font-mono focus:border-stone-400 focus:outline-none transition-all text-left"
                        dir="ltr"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">واتساپ (WhatsApp)</label>
                      <input
                        type="text"
                        value={socialWhatsapp}
                        onChange={(e) => setSocialWhatsapp(e.target.value)}
                        placeholder="+46700000000"
                        className="w-full h-10 rounded-xl bg-stone-50 hover:bg-stone-100/70 focus:bg-white border border-stone-200/80 px-3 text-xs text-zinc-900 font-mono focus:border-stone-400 focus:outline-none transition-all text-left"
                        dir="ltr"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">یوتیوب (YouTube)</label>
                      <input
                        type="text"
                        value={socialYoutube}
                        onChange={(e) => setSocialYoutube(e.target.value)}
                        placeholder="https://youtube.com/@..."
                        className="w-full h-10 rounded-xl bg-stone-50 hover:bg-stone-100/70 focus:bg-white border border-stone-200/80 px-3 text-xs text-zinc-900 font-mono focus:border-stone-400 focus:outline-none transition-all text-left"
                        dir="ltr"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">لینکدین (LinkedIn)</label>
                      <input
                        type="text"
                        value={socialLinkedin}
                        onChange={(e) => setSocialLinkedin(e.target.value)}
                        placeholder="https://linkedin.com/company/..."
                        className="w-full h-10 rounded-xl bg-stone-50 hover:bg-stone-100/70 focus:bg-white border border-stone-200/80 px-3 text-xs text-zinc-900 font-mono focus:border-stone-400 focus:outline-none transition-all text-left"
                        dir="ltr"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={savingSettings}
                    className="h-10 px-5 rounded-xl bg-slate-900 hover:bg-black text-white font-bold text-xs flex items-center gap-2 shadow-2xs active:scale-[0.98] transition-all cursor-pointer"
                  >
                    <Save size={15} />
                    <span>ذخیره مشخصات</span>
                  </button>
                </div>
              </form>
            </div>
              )}

              {settingsSubTab === 'seo' && (
            <div className="space-y-6 w-full py-2 animate-in fade-in duration-150 ease-out">
              {/* Country-Specific Complete SEO, Countries Manager & Hero Background Photo Suite */}
              <div className="rounded-2xl bg-white border border-stone-200/80 p-5 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-5">
                <div className="flex flex-col gap-3 pb-4 border-b border-stone-200/80">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-black text-zinc-900">مدیریت کشورها، تصویر پس‌زمینه هیرو و سئوی گوگل (SEO)</h3>
                      <p className="text-[11px] text-stone-500 mt-0.5">
                        تغییر تصویر پس‌زمینه هر کشور، مدیریت ۸ کشور اروپایی و تنظیم متاتگ‌های سئوی گوگل
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setNewCountryOpen((v) => !v)}
                      className="h-9 px-3.5 rounded-xl bg-[#0066CC] hover:bg-[#0055AA] text-white text-xs font-bold inline-flex items-center gap-1.5 shrink-0 self-start sm:self-auto transition-colors cursor-pointer"
                    >
                      <Plus size={14} />
                      <span>{newCountryOpen ? 'بستن فرم کشور جدید' : 'افزودن کشور جدید'}</span>
                    </button>
                  </div>
                  
                  {/* Country Switcher Tabs (All Active & Custom Countries) */}
                  <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl border border-stone-200/80 flex-wrap">
                    {countriesList.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSeoActiveCountry(c.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                          seoActiveCountry === c.id
                            ? 'bg-slate-900 text-white shadow-2xs'
                            : 'text-stone-600 hover:text-zinc-900'
                        }`}
                      >
                        {renderCountryFlag(c.id)}
                        <span>{c.nameFa}</span>
                        {c.enabled === false && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300">غیرفعال</span>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Inline Add New Country Form */}
                  {newCountryOpen && (
                    <div className="rounded-xl bg-stone-50 border border-stone-200/80 p-4 space-y-3 animate-in fade-in duration-150">
                      <h4 className="text-xs font-extrabold text-zinc-900">افزودن کشور جدید به پلتفرم لینک شو</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-stone-700 mb-1">کد کشور (۲ حرف انگلیسی، مثال: uk یا ch) *</label>
                          <input
                            type="text"
                            maxLength={8}
                            value={newCountryForm.id}
                            onChange={(e) => setNewCountryForm(prev => ({ ...prev, id: e.target.value.toLowerCase() }))}
                            placeholder="uk"
                            className="w-full h-9 rounded-xl bg-white border border-stone-200 px-3 text-xs font-mono text-left"
                            dir="ltr"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-stone-700 mb-1">نام فارسی کشور *</label>
                          <input
                            type="text"
                            value={newCountryForm.nameFa}
                            onChange={(e) => setNewCountryForm(prev => ({ ...prev, nameFa: e.target.value }))}
                            placeholder="مثال: انگلیس یا سوئیس"
                            className="w-full h-9 rounded-xl bg-white border border-stone-200 px-3 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-stone-700 mb-1">واحد پول (مثال: € یا £ یا $)</label>
                          <input
                            type="text"
                            value={newCountryForm.currency}
                            onChange={(e) => setNewCountryForm(prev => ({ ...prev, currency: e.target.value }))}
                            placeholder="€"
                            className="w-full h-9 rounded-xl bg-white border border-stone-200 px-3 text-xs font-mono text-left"
                            dir="ltr"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-stone-700 mb-1">لینک تصویر پس‌زمینه هیرو (یا بعد از ثبت آپلود کنید)</label>
                          <input
                            type="url"
                            value={newCountryForm.heroImage}
                            onChange={(e) => setNewCountryForm(prev => ({ ...prev, heroImage: e.target.value }))}
                            placeholder="https://images.unsplash.com/..."
                            className="w-full h-9 rounded-xl bg-white border border-stone-200 px-3 text-xs font-mono text-left"
                            dir="ltr"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-stone-700 mb-1">شهرهای اصلی (با ویرگول جدا کنید)</label>
                          <input
                            type="text"
                            value={newCountryForm.citiesText}
                            onChange={(e) => setNewCountryForm(prev => ({ ...prev, citiesText: e.target.value }))}
                            placeholder="مثال: لندن، منچستر، بیرمنگام، لیدز"
                            className="w-full h-9 rounded-xl bg-white border border-stone-200 px-3 text-xs"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setNewCountryOpen(false)}
                          className="h-9 px-3.5 rounded-xl bg-stone-200/70 hover:bg-stone-200 text-stone-700 text-xs font-bold cursor-pointer"
                        >
                          انصراف
                        </button>
                        <button
                          type="button"
                          onClick={handleAddNewCountry}
                          className="h-9 px-4 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold cursor-pointer"
                        >
                          ثبت و افزودن کشور
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Live Google Search Result Preview (SERP) & Hero Background Photo Manager */}
                {(() => {
                  const activeCountryObj = countriesList.find(c => c.id === seoActiveCountry) || countriesList[0];
                  const cName = activeCountryObj?.nameFa || 'سوئد';
                  const curSeo = seoSettings[seoActiveCountry] || DEFAULT_COUNTRY_SEO[seoActiveCountry] || {
                    title: `لینک شو ${cName} | نیازمندی‌ها، مسکن، کاریابی و خدمات فارسی‌زبانان در ${cName}`,
                    description: `لینک شو — محل رشد کسب و کار فارسی‌زبانان و مرجع آگهی‌های رایگان مسکن، رستوران، کاریابی و خدمات در سراسر ${cName}.`,
                    keywords: `لینک شو, نیازمندیهای ${cName}, فارسی زبانان ${cName}, مسکن ${cName}, کار در ${cName}`,
                    heroHeading: `نیازمندی‌های فارسی‌زبانان ${cName}`,
                    heroSubheading: `مسکن، رستوران، خدمات و کاریابی در سراسر ${cName}`,
                    ogTitle: `لینک شو ${cName} | مرجع نیازمندی‌های فارسی‌زبانان در ${cName}`,
                    ogDescription: `ثبت و جستجوی مستقیم و رایگان مسکن، کار، رستوران و خدمات در سراسر ${cName}.`
                  };
                  const titleLen = (curSeo?.title || '').length;
                  const descLen = (curSeo?.description || '').length;
                  const kwList = (curSeo?.keywords || '')
                    .split(/[،,]/)
                    .map(k => k.trim())
                    .filter(Boolean);

                  return (
                    <form onSubmit={saveSeoSettings} className="space-y-4">
                      {/* Country Hero Background Photo & Status Manager */}
                      <div className="rounded-xl bg-stone-50 p-4 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <h4 className="text-xs font-extrabold text-zinc-900">
                              تصویر پس‌زمینه هیرو برای کشور «{cName}»
                            </h4>
                            <p className="text-[11px] text-stone-500">
                              می‌توانید تصویر پس‌زمینه بالای سایت برای کشور {cName} را مستقیم آپلود کنید یا لینک تصویر قرار دهید
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={async () => {
                                const next = countriesList.map(c =>
                                  c.id === seoActiveCountry ? { ...c, enabled: c.enabled === false ? true : false } : c
                                );
                                await persistCountries(next);
                                triggerToast(`وضعیت نمایش کشور «${cName}» به‌روزرسانی شد.`);
                              }}
                              className={`h-8 px-3 rounded-lg text-[11px] font-bold cursor-pointer transition-colors ${
                                activeCountryObj?.enabled !== false
                                  ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                  : 'bg-stone-200 text-stone-700 hover:bg-stone-300'
                              }`}
                            >
                              {activeCountryObj?.enabled !== false ? 'فعال در سایت' : 'غیرفعال در سایت'}
                            </button>

                            {!activeCountryObj?.isSystem && (
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!window.confirm(`آیا از حذف کشور «${cName}» مطمئن هستید؟`)) return;
                                  const next = countriesList.filter(c => c.id !== seoActiveCountry);
                                  await persistCountries(next);
                                  setSeoActiveCountry(next[0]?.id || 'se');
                                  triggerToast(`کشور «${cName}» حذف شد.`);
                                }}
                                className="h-8 px-2.5 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-700 text-[11px] font-bold cursor-pointer"
                              >
                                حذف کشور
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Hero Preview + Upload/URL Input */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                          <div className="relative h-20 w-full sm:w-40 rounded-xl overflow-hidden bg-stone-200 shrink-0 border border-stone-300">
                            <img
                              src={activeCountryObj?.heroImage || '/images/cities/stockholm.jpg'}
                              alt={cName}
                              className="w-full h-full object-cover"
                            />
                          </div>

                          <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                            <label className="h-10 px-3.5 rounded-xl bg-[#0066CC] hover:bg-[#0055AA] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer shrink-0 transition-colors active:scale-95">
                              <Plus size={14} />
                              <span>
                                {uploadingBrandKey === `country_${seoActiveCountry}`
                                  ? 'در حال آپلود...'
                                  : 'آپلود عکس پس‌زمینه'}
                              </span>
                              <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                disabled={uploadingBrandKey !== null}
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  e.target.value = '';
                                  handleCountryHeroUpload(f, seoActiveCountry);
                                }}
                                className="hidden"
                              />
                            </label>

                            <input
                              type="url"
                              value={activeCountryObj?.heroImage || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setCountriesList(prev =>
                                  prev.map(c => (c.id === seoActiveCountry ? { ...c, heroImage: val } : c))
                                );
                              }}
                              placeholder="https://... یا /images/cities/..."
                              className="flex-1 min-w-0 h-10 rounded-xl bg-white border border-stone-200/80 px-3 text-xs text-zinc-900 font-mono focus:border-stone-400 focus:outline-none text-left"
                              dir="ltr"
                            />

                            <button
                              type="button"
                              onClick={async () => {
                                await persistCountries(countriesList);
                                triggerToast(`تصویر پس‌زمینه کشور «${cName}» ذخیره شد!`);
                              }}
                              className="h-10 px-4 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold shrink-0 cursor-pointer"
                            >
                              ذخیره تصویر
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* SERP Preview Box */}
                      <div className="rounded-xl bg-stone-50 p-4 space-y-1.5 text-right">
                        <div className="flex items-center justify-between text-[11px] text-stone-400">
                          <span>پیش‌نمایش زنده در نتایج گوگل ({cName})</span>
                          <span className="font-mono" dir="ltr">linksho.com/?c={seoActiveCountry}</span>
                        </div>
                        <div className="text-sm font-bold text-[#1a0dab] truncate">
                          {curSeo?.title || 'عنوان سئو...'}
                        </div>
                        <div className="text-xs text-stone-600 leading-relaxed line-clamp-2">
                          {curSeo?.description || 'توضیحات متا در نتایج گوگل...'}
                        </div>
                      </div>

                      {/* Row 1: Meta Title */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-bold text-stone-700">
                            عنوان صفحه در نتایج گوگل (Meta Title)
                          </label>
                          <span className={`text-[11px] font-semibold ${titleLen >= 40 && titleLen <= 70 ? 'text-emerald-600' : 'text-stone-400'}`}>
                            {titleLen} کاراکتر (بهینه: ۵۰ تا ۶۵)
                          </span>
                        </div>
                        <input
                          type="text"
                          value={curSeo?.title || ''}
                          onChange={(e) => setSeoSettings(prev => ({
                            ...prev,
                            [seoActiveCountry]: {
                              ...prev[seoActiveCountry],
                              title: e.target.value
                            }
                          }))}
                          className="w-full h-10 rounded-xl bg-stone-50 hover:bg-stone-100/70 focus:bg-white border border-stone-200/80 px-3 text-xs text-zinc-900 focus:border-stone-400 focus:outline-none transition-all"
                        />
                      </div>

                      {/* Row 2: Meta Description */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-bold text-stone-700">
                            توضیحات متاتگ گوگل (Meta Description — معرفی مختصر و حرفه‌ای)
                          </label>
                          <span className={`text-[11px] font-semibold ${descLen >= 110 && descLen <= 165 ? 'text-emerald-600' : 'text-stone-400'}`}>
                            {descLen} کاراکتر (بهینه: ۱۲۰ تا ۱۶۰)
                          </span>
                        </div>
                        <textarea
                          rows={3}
                          value={curSeo?.description || ''}
                          onChange={(e) => setSeoSettings(prev => ({
                            ...prev,
                            [seoActiveCountry]: {
                              ...prev[seoActiveCountry],
                              description: e.target.value
                            }
                          }))}
                          className="w-full rounded-xl bg-stone-50 hover:bg-stone-100/70 focus:bg-white border border-stone-200/80 p-3 text-xs text-zinc-900 focus:border-stone-400 focus:outline-none transition-all leading-relaxed"
                        />
                      </div>

                      {/* Row 3: Homepage Hero H1 & Subtitle per Country */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-stone-700 mb-1.5">
                            تیتر اصلی هیرو کشور در صفحه اول (تگ H1)
                          </label>
                          <input
                            type="text"
                            value={curSeo?.heroHeading || ''}
                            onChange={(e) => setSeoSettings(prev => ({
                              ...prev,
                              [seoActiveCountry]: {
                                ...prev[seoActiveCountry],
                                heroHeading: e.target.value
                              }
                            }))}
                            placeholder="مثال: نیازمندی‌های فارسی‌زبانان سوئد"
                            className="w-full h-10 rounded-xl bg-stone-50 hover:bg-stone-100/70 focus:bg-white border border-stone-200/80 px-3 text-xs text-zinc-900 focus:border-stone-400 focus:outline-none transition-all"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-stone-700 mb-1.5">
                            زیرتیتر هیرو کشور در صفحه اول
                          </label>
                          <input
                            type="text"
                            value={curSeo?.heroSubheading || ''}
                            onChange={(e) => setSeoSettings(prev => ({
                              ...prev,
                              [seoActiveCountry]: {
                                ...prev[seoActiveCountry],
                                heroSubheading: e.target.value
                              }
                            }))}
                            placeholder="مثال: مسکن، رستوران، خدمات و کاریابی در سراسر سوئد"
                            className="w-full h-10 rounded-xl bg-stone-50 hover:bg-stone-100/70 focus:bg-white border border-stone-200/80 px-3 text-xs text-zinc-900 focus:border-stone-400 focus:outline-none transition-all"
                          />
                        </div>
                      </div>

                      {/* Row 4: Keywords + Pill Preview */}
                      <div>
                        <label className="block text-xs font-bold text-stone-700 mb-1.5">
                          کلمات کلیدی هدف (با ویرگول جدا کنید)
                        </label>
                        <input
                          type="text"
                          value={curSeo?.keywords || ''}
                          onChange={(e) => setSeoSettings(prev => ({
                            ...prev,
                            [seoActiveCountry]: {
                              ...prev[seoActiveCountry],
                              keywords: e.target.value
                            }
                          }))}
                          className="w-full h-10 rounded-xl bg-stone-50 hover:bg-stone-100/70 focus:bg-white border border-stone-200/80 px-3 text-xs text-zinc-900 focus:border-stone-400 focus:outline-none transition-all"
                        />
                        {kwList.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-2">
                            {kwList.map((kw, i) => (
                              <span key={i} className="px-2.5 py-0.5 rounded-full bg-stone-100 text-stone-700 text-[11px] font-medium">
                                {kw}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Row 5: OpenGraph / Social Sharing Title & Description */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <div>
                          <label className="block text-xs font-bold text-stone-700 mb-1.5">
                            عنوان اشتراک‌گذاری در تلگرام و شبکه‌ها (OG Title)
                          </label>
                          <input
                            type="text"
                            value={curSeo?.ogTitle || ''}
                            onChange={(e) => setSeoSettings(prev => ({
                              ...prev,
                              [seoActiveCountry]: {
                                ...prev[seoActiveCountry],
                                ogTitle: e.target.value
                              }
                            }))}
                            placeholder={curSeo?.title || ''}
                            className="w-full h-10 rounded-xl bg-stone-50 hover:bg-stone-100/70 focus:bg-white border border-stone-200/80 px-3 text-xs text-zinc-900 focus:border-stone-400 focus:outline-none transition-all"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-stone-700 mb-1.5">
                            توضیحات اشتراک‌گذاری شبکه‌ها (OG Description)
                          </label>
                          <input
                            type="text"
                            value={curSeo?.ogDescription || ''}
                            onChange={(e) => setSeoSettings(prev => ({
                              ...prev,
                              [seoActiveCountry]: {
                                ...prev[seoActiveCountry],
                                ogDescription: e.target.value
                              }
                            }))}
                            placeholder={curSeo?.description || ''}
                            className="w-full h-10 rounded-xl bg-stone-50 hover:bg-stone-100/70 focus:bg-white border border-stone-200/80 px-3 text-xs text-zinc-900 focus:border-stone-400 focus:outline-none transition-all"
                          />
                        </div>
                      </div>

                      <div className="pt-2 flex flex-wrap items-center justify-between gap-2">
                        <button
                          type="submit"
                          disabled={savingSettings}
                          className="h-10 px-5 rounded-xl bg-slate-900 hover:bg-black text-white font-bold text-xs flex items-center gap-2 active:scale-[0.98] transition-all cursor-pointer"
                        >
                          <Save size={15} />
                          <span>ذخیره سئوی کشورها</span>
                        </button>

                        <button
                          type="button"
                            onClick={() => {
                              const fallbackSeo = DEFAULT_COUNTRY_SEO[seoActiveCountry] || {
                                title: `لینک شو ${cName} | نیازمندی‌ها، مسکن، کاریابی و خدمات فارسی‌زبانان در ${cName}`,
                                description: `لینک شو — محل رشد کسب و کار فارسی‌زبانان و مرجع آگهی‌های رایگان مسکن، رستوران، کاریابی و خدمات در سراسر ${cName}.`,
                                keywords: `لینک شو, نیازمندیهای ${cName}, فارسی زبانان ${cName}, مسکن ${cName}, کار در ${cName}`,
                                heroHeading: `نیازمندی‌های فارسی‌زبانان ${cName}`,
                                heroSubheading: `مسکن، رستوران، خدمات و کاریابی در سراسر ${cName}`,
                                ogTitle: `لینک شو ${cName} | مرجع نیازمندی‌های فارسی‌زبانان در ${cName}`,
                                ogDescription: `ثبت و جستجوی مستقیم و رایگان مسکن، کار، رستوران و خدمات در سراسر ${cName}.`
                              };
                              setSeoSettings(prev => ({
                                ...prev,
                                [seoActiveCountry]: { ...fallbackSeo }
                              }));
                            }}
                          className="h-9 px-3.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs transition-colors cursor-pointer"
                        >
                          بازنشانی به سئوی استاندارد {cName}
                        </button>
                      </div>
                    </form>
                  );
                })()}
              </div>

              {/* Google Analytics (GA4) Card */}
              <div className="rounded-2xl bg-white border border-stone-200/80 p-5 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <h3 className="text-xs font-extrabold text-zinc-900">گوگل آنالیتیکس (آمار بازدیدکنندگان)</h3>
                    <p className="text-[11px] text-stone-500 mt-0.5">ردیابی لحظه‌ای بازدید صفحات، کشورها و آگهی‌ها در سایت اصلی</p>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                    analyticsSettings.enabled
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-stone-100 text-stone-500 border-stone-200'
                  }`}>
                    {analyticsSettings.enabled ? 'فعال' : 'غیرفعال'}
                  </span>
                </div>

                <form onSubmit={saveAnalyticsSettings} className="space-y-4">
                  <label className="flex items-center justify-between p-4 rounded-xl bg-stone-50 hover:bg-stone-100/70 border border-stone-200/80 cursor-pointer transition-all shadow-2xs">
                    <div>
                      <span className="text-xs font-bold text-zinc-900 block">فعال‌سازی گوگل آنالیتیکس در سایت</span>
                      <span className="text-[11px] text-stone-500">ارسال خودکار آمار بازدید صفحات و آگهی‌ها</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={analyticsSettings.enabled}
                      onChange={(e) => setAnalyticsSettings(prev => ({ ...prev, enabled: e.target.checked }))}
                      className="h-4 w-4 rounded text-zinc-900 focus:ring-zinc-900 cursor-pointer"
                    />
                  </label>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1.5">شناسه اندازه‌گیری گوگل آنالیتیکس</label>
                    <input
                      type="text"
                      dir="ltr"
                      placeholder="G-XXXXXXXXXX"
                      value={analyticsSettings.measurementId || ''}
                      onChange={(e) => setAnalyticsSettings(prev => ({ ...prev, measurementId: e.target.value }))}
                      className="w-full h-10 rounded-xl bg-stone-50 hover:bg-stone-100/70 focus:bg-white border border-stone-200/80 px-3.5 text-xs text-zinc-900 font-mono focus:border-stone-400 focus:outline-none transition-all shadow-2xs"
                    />
                  </div>

                  <div className="pt-1">
                    <button
                      type="submit"
                      disabled={savingSettings}
                      className="h-10 px-5 rounded-xl bg-slate-900 hover:bg-black disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 shadow-2xs active:scale-[0.98] transition-all cursor-pointer"
                    >
                      <Save size={15} />
                      <span>ذخیره تنظیمات آنالیتیکس</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Cloudflare R2 Object Storage Card */}
              <div className="rounded-2xl bg-white border border-stone-200/80 p-5 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <h3 className="text-xs font-extrabold text-zinc-900">فضای ابری تصاویر (کلودفلر R2)</h3>
                    <p className="text-[11px] text-stone-500 mt-0.5">حداکثر ۴ تصویر برای هر آگهی • حداکثر ۱ مگابایت برای هر تصویر</p>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                    r2Settings.enabled
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-stone-100 text-stone-500 border-stone-200'
                  }`}>
                    {r2Settings.enabled ? 'فعال' : 'غیرفعال'}
                  </span>
                </div>

                <form onSubmit={saveR2Settings} className="space-y-4">
                  <label className="flex items-center justify-between p-4 rounded-xl bg-stone-50 hover:bg-stone-100/70 border border-stone-200/80 cursor-pointer transition-all shadow-2xs">
                    <div>
                      <span className="text-xs font-bold text-zinc-900 block">فعال‌سازی آپلود مستقیم تصاویر در کلودفلر R2</span>
                      <span className="text-[11px] text-stone-500">فشرده‌سازی خودکار تصاویر و ذخیره پرسرعت در فضای ابری</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={r2Settings.enabled}
                      onChange={(e) => setR2Settings(prev => ({ ...prev, enabled: e.target.checked }))}
                      className="h-4 w-4 rounded text-zinc-900 focus:ring-zinc-900 cursor-pointer"
                    />
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1.5">شناسه حساب کلودفلر</label>
                      <input
                        type="text"
                        dir="ltr"
                        placeholder="Account ID"
                        value={r2Settings.accountId || ''}
                        onChange={(e) => setR2Settings(prev => ({ ...prev, accountId: e.target.value }))}
                        className="w-full h-10 rounded-xl bg-stone-50 hover:bg-stone-100/70 focus:bg-white border border-stone-200/80 px-3.5 text-xs text-zinc-900 font-mono focus:border-stone-400 focus:outline-none transition-all shadow-2xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1.5">نام سطل ذخیره‌سازی</label>
                      <input
                        type="text"
                        dir="ltr"
                        placeholder="farsinord-images"
                        value={r2Settings.bucketName || ''}
                        onChange={(e) => setR2Settings(prev => ({ ...prev, bucketName: e.target.value }))}
                        className="w-full h-10 rounded-xl bg-stone-50 hover:bg-stone-100/70 focus:bg-white border border-stone-200/80 px-3.5 text-xs text-zinc-900 font-mono focus:border-stone-400 focus:outline-none transition-all shadow-2xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1.5">آدرس عمومی دامنه تصاویر</label>
                    <input
                      type="url"
                      dir="ltr"
                      placeholder="https://images.yourdomain.com"
                      value={r2Settings.publicUrl || ''}
                      onChange={(e) => setR2Settings(prev => ({ ...prev, publicUrl: e.target.value }))}
                      className="w-full h-10 rounded-xl bg-stone-50 hover:bg-stone-100/70 focus:bg-white border border-stone-200/80 px-3.5 text-xs text-zinc-900 font-mono focus:border-stone-400 focus:outline-none transition-all shadow-2xs"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1.5">کلید دسترسی</label>
                      <input
                        type="password"
                        dir="ltr"
                        placeholder={r2Settings.hasCredentials ? 'ثبت شده (برای تغییر وارد کنید)' : 'Access Key ID'}
                        value={r2Settings.accessKeyId || ''}
                        onChange={(e) => setR2Settings(prev => ({ ...prev, accessKeyId: e.target.value }))}
                        className="w-full h-10 rounded-xl bg-stone-50 hover:bg-stone-100/70 focus:bg-white border border-stone-200/80 px-3.5 text-xs text-zinc-900 font-mono focus:border-stone-400 focus:outline-none transition-all shadow-2xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1.5">کلید محرمانه</label>
                      <input
                        type="password"
                        dir="ltr"
                        placeholder={r2Settings.hasCredentials ? 'ثبت شده (برای تغییر وارد کنید)' : 'Secret Access Key'}
                        value={r2Settings.secretAccessKey || ''}
                        onChange={(e) => setR2Settings(prev => ({ ...prev, secretAccessKey: e.target.value }))}
                        className="w-full h-10 rounded-xl bg-stone-50 hover:bg-stone-100/70 focus:bg-white border border-stone-200/80 px-3.5 text-xs text-zinc-900 font-mono focus:border-stone-400 focus:outline-none transition-all shadow-2xs"
                      />
                    </div>
                  </div>

                  <div className="pt-1">
                    <button
                      type="submit"
                      disabled={savingSettings}
                      className="h-10 px-5 rounded-xl bg-slate-900 hover:bg-black disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 shadow-2xs active:scale-[0.98] transition-all cursor-pointer"
                    >
                      <Save size={15} />
                      <span>ذخیره تنظیمات فضای ابری</span>
                    </button>
                  </div>
                </form>
              </div>

            </div>
              )}
            </div>
          )}

        </div>

      </div>

      {/* ========================================================
          CENTERED FULL-INFO MODAL DIALOG (Centered, Frosted Backdrop)
      ======================================================== */}
      {selectedAdForModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/65 animate-in fade-in duration-150 select-none"
          dir="rtl"
          onClick={() => setSelectedAdForModal(null)}
        >
          <div 
            className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150 select-text"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between gap-2 px-4 sm:px-6 py-3.5 sm:py-4 border-b border-stone-100 bg-stone-50/70">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <span className="font-extrabold text-[14.5px] sm:text-[15px] text-stone-900">
                  جزئیات کامل آگهی
                </span>
                <span dir="ltr" className="inline-flex items-center font-mono text-xs font-bold text-stone-700 bg-stone-200/80 px-2 py-0.5 rounded whitespace-nowrap">
                  <span>#</span>
                  <span>{selectedAdForModal.reference_number || selectedAdForModal.id.slice(0, 8)}</span>
                </span>
                <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[11px] font-bold border border-blue-200 whitespace-nowrap inline-flex items-center gap-1">
                  {renderCountryFlag(selectedAdForModal.country || 'se')}
                  <span>{countriesList.find(c => c.id === (selectedAdForModal.country || 'se'))?.nameFa}</span>
                </span>
              </div>

              <button
                type="button"
                onClick={() => setSelectedAdForModal(null)}
                className="h-8 w-8 shrink-0 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-500 hover:text-stone-800 transition-colors cursor-pointer"
                title="بستن پنجره"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body (Natural internal scroll) */}
            <div className="overflow-y-auto no-scrollbar p-4 sm:p-6 space-y-4 sm:space-y-5 flex-1">
              
              {/* Photo Preview / Gallery */}
              {selectedAdForModal.images && selectedAdForModal.images.length > 0 ? (
                <div className="space-y-2">
                  <div className="w-full h-52 sm:h-72 rounded-2xl overflow-hidden bg-stone-100 border border-stone-200 shadow-2xs">
                    <img 
                      src={selectedAdForModal.images[0]} 
                      alt="" 
                      className="w-full h-full object-cover" 
                    />
                  </div>
                  {selectedAdForModal.images.length > 1 && (
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                      {selectedAdForModal.images.map((imgUrl, idx) => (
                        <div key={idx} className="h-16 rounded-xl overflow-hidden bg-stone-100 border border-stone-200">
                          <img src={imgUrl} alt="" className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-full h-32 rounded-2xl bg-stone-50 border border-stone-200/80 flex flex-col items-center justify-center text-stone-400 gap-1.5">
                  <ImageIcon size={28} className="text-stone-300" />
                  <span className="text-xs">تصویری برای این آگهی ثبت نشده است</span>
                </div>
              )}

              {/* Title & Key Codes */}
              <div className="space-y-2 pb-3 border-b border-stone-100">
                <h2 className="text-lg font-black text-stone-900 leading-snug">
                  {selectedAdForModal.title}
                </h2>

                <div className="flex items-center gap-2.5 text-xs text-stone-500 flex-wrap">
                  <button
                    type="button"
                    onClick={() => copyText(selectedAdForModal.reference_number, `modal-ref`, 'کد پیگیری')}
                    className="text-xs font-bold text-stone-800 bg-stone-100 hover:bg-stone-200 px-2.5 py-1 rounded-lg border border-stone-200 flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>کد رهگیری:</span>
                    <span dir="ltr" className="inline-flex items-center font-mono">
                      <span>#</span>
                      <span>{selectedAdForModal.reference_number || selectedAdForModal.id.slice(0, 8)}</span>
                    </span>
                    <Copy size={12} className="text-stone-400" />
                  </button>

                  <button
                    type="button"
                    onClick={() => copyText(selectedAdForModal.pin_code || '1234', `modal-pin`, 'رمز ویرایش')}
                    className="text-xs font-extrabold text-amber-900 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-lg border border-amber-200 flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>رمز ویرایش: <span className="font-mono">{selectedAdForModal.pin_code || '1234'}</span></span>
                    <Copy size={12} className="text-amber-600" />
                  </button>

                  <span className="flex items-center gap-1 tabular-nums text-stone-600 font-semibold">
                    <Eye size={13} className="text-stone-400" />
                    <span>{selectedAdForModal.views_count || 1} بازدید</span>
                  </span>

                  <span className="text-stone-500 tabular-nums text-xs">
                    تاریخ ثبت: <span dir="ltr" className="inline-block font-mono">{new Date(selectedAdForModal.created_at || '2026-01-01').toLocaleDateString('sv-SE')}</span>
                  </span>
                </div>
              </div>

              {/* Location & Pricing Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200/80 space-y-1">
                  <span className="text-[11px] font-bold text-stone-400 uppercase">موقعیت مکانی</span>
                  <div className="flex items-center gap-1.5 text-sm font-bold text-stone-900">
                    <MapPin size={15} className="text-blue-600" />
                    <span>{selectedAdForModal.city || 'نامشخص'} ({countriesList.find(c => c.id === (selectedAdForModal.country || 'se'))?.nameFa})</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200/80 space-y-1">
                  <span className="text-[11px] font-bold text-stone-400 uppercase">قیمت / مبلغ</span>
                  <div className="text-sm font-extrabold text-stone-900 tabular-nums">
                    {selectedAdForModal.price ? `${Number(selectedAdForModal.price).toLocaleString('sv-SE')} کرون` : 'توافقی'}
                  </div>
                </div>
              </div>

              {/* Full Description */}
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-stone-500">متن کامل آگهی:</span>
                <div className="p-4 rounded-2xl bg-stone-50/70 border border-stone-200/70 text-xs sm:text-[13px] text-stone-700 leading-relaxed whitespace-pre-line">
                  {selectedAdForModal.description || 'توضیحاتی برای این آگهی ثبت نشده است.'}
                </div>
              </div>

              {/* Full Contact Information Card */}
              <div className="p-4 rounded-2xl bg-blue-50/40 border border-blue-200/70 space-y-3">
                <span className="text-xs font-bold text-blue-900 block">اطلاعات کامل تماس آگهی‌دهنده:</span>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  {selectedAdForModal.contact_name && (
                    <div className="flex items-center gap-2 text-stone-800">
                      <User size={14} className="text-stone-400 shrink-0" />
                      <span className="text-stone-500">نام:</span>
                      <span className="font-bold">{selectedAdForModal.contact_name}</span>
                    </div>
                  )}

                  {selectedAdForModal.contact_phone && (
                    <a
                      href={`tel:${selectedAdForModal.contact_phone}`}
                      className="flex items-center gap-2 text-blue-700 font-bold hover:underline"
                    >
                      <Phone size={14} className="text-blue-500 shrink-0" />
                      <span dir="ltr" className="font-mono">{selectedAdForModal.contact_phone}</span>
                    </a>
                  )}

                  {selectedAdForModal.contact_whatsapp && (
                    <a
                      href={`https://wa.me/${selectedAdForModal.contact_whatsapp.replace(/[^0-9]/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 text-emerald-700 font-bold hover:underline"
                    >
                      <span>واتساپ:</span>
                      <span dir="ltr" className="font-mono">{selectedAdForModal.contact_whatsapp}</span>
                    </a>
                  )}

                  {selectedAdForModal.contact_telegram && (
                    <a
                      href={`https://t.me/${selectedAdForModal.contact_telegram.replace('@', '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 text-sky-700 font-bold hover:underline"
                    >
                      <Send size={13} className="shrink-0" />
                      <span dir="ltr" className="font-mono">{selectedAdForModal.contact_telegram}</span>
                    </a>
                  )}

                  {selectedAdForModal.contact_email && (
                    <a
                      href={`mailto:${selectedAdForModal.contact_email}`}
                      className="flex items-center gap-2 text-stone-600 hover:text-stone-900 hover:underline sm:col-span-2"
                    >
                      <Mail size={14} className="text-stone-400 shrink-0" />
                      <span dir="ltr" className="font-mono">{selectedAdForModal.contact_email}</span>
                    </a>
                  )}

                  {selectedAdForModal.contact_website && !/^(javascript|data|vbscript):/i.test(selectedAdForModal.contact_website.trim()) && (
                    <a
                      href={/^https?:\/\//i.test(selectedAdForModal.contact_website.trim()) ? selectedAdForModal.contact_website.trim() : `https://${selectedAdForModal.contact_website.trim()}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 text-blue-700 hover:underline sm:col-span-2"
                    >
                      <Globe2 size={14} className="shrink-0" />
                      <span dir="ltr" className="font-mono truncate">{selectedAdForModal.contact_website}</span>
                    </a>
                  )}
                </div>
              </div>

              {/* Quick Country Switcher */}
              <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <span className="text-xs font-bold text-stone-600 shrink-0">تغییر کشور آگهی:</span>
                <div className="flex flex-wrap rounded-xl border border-stone-200 bg-white p-1 gap-1">
                  {countriesList.map(c => {
                    const isCurrent = (selectedAdForModal.country || 'se') === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => updateAdCountry(selectedAdForModal.id, c.id)}
                        className={`px-2.5 py-1.5 sm:py-1 rounded-lg text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                          isCurrent
                            ? 'bg-slate-900 text-white shadow-2xs'
                            : 'text-stone-600 hover:text-stone-950 hover:bg-stone-100'
                        }`}
                      >
                        {renderCountryFlag(c.id)}
                        <span>{c.nameFa}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* Modal Footer Actions */}
            <div className="px-4 sm:px-6 py-3.5 sm:py-4 bg-stone-50 border-t border-stone-100 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
                {selectedAdForModal.status !== 'active' && (
                  <button
                    type="button"
                    onClick={() => approveAdAdmin(selectedAdForModal.id)}
                    className="flex-1 sm:flex-initial h-10 sm:h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all whitespace-nowrap"
                  >
                    <CheckCircle size={14} />
                    <span>تایید و انتشار</span>
                  </button>
                )}
                {/* View on Site */}
                <button
                  type="button"
                  onClick={() => {
                    const base = (getMainSiteUrl() || 'https://swedpersiska.vercel.app').replace(/\/+$/, '');
                    window.open(`${base}/?ad=${selectedAdForModal.reference_number || selectedAdForModal.id}`, '_blank', 'noopener,noreferrer');
                  }}
                  className="flex-1 sm:flex-initial h-10 sm:h-9 px-3.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-100 text-stone-700 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all whitespace-nowrap"
                >
                  <ExternalLink size={14} />
                  <span>مشاهده در سایت</span>
                </button>

                {/* Delete Ad */}
                <button
                  type="button"
                  onClick={() => deleteAdAdmin(selectedAdForModal.id)}
                  className="flex-1 sm:flex-initial h-10 sm:h-9 px-3.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all whitespace-nowrap"
                >
                  <Trash2 size={14} />
                  <span>حذف آگهی</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setSelectedAdForModal(null)}
                className="w-full sm:w-auto h-10 sm:h-9 px-5 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-800 text-xs font-bold cursor-pointer transition-colors"
              >
                بستن
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================
          CATEGORY ADD / EDIT MODAL (FROSTED GLASS RTL)
      ======================================================== */}
      {categoryModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-md font-vazir animate-in fade-in duration-150 select-none" dir="rtl">
          <div 
            className="fixed inset-0"
            onClick={() => setCategoryModal(prev => ({ ...prev, isOpen: false }))}
          />

          <div className="relative z-10 w-full max-w-lg bg-white rounded-3xl border border-stone-200 shadow-2xl p-6 sm:p-7 text-right space-y-5 animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-stone-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 border border-blue-200/60 shadow-2xs">
                  <FolderTree size={20} />
                </div>
                <div>
                  <h3 className="font-extrabold text-[16px] text-stone-900 tracking-tight">
                    {categoryModal.mode === 'add' ? 'افزودن دسته‌بندی جدید' : 'ویرایش دسته‌بندی'}
                  </h3>
                  <p className="text-[11.5px] text-stone-400">
                    {categoryModal.mode === 'add' ? 'یک دسته‌بندی تازه به پرتال اضافه کنید' : `ویرایش مشخصات دسته‌بندی #${categoryModal.id}`}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setCategoryModal(prev => ({ ...prev, isOpen: false }))}
                className="h-8 w-8 flex items-center justify-center rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-500 cursor-pointer active:scale-90 transition-all"
              >
                <X size={16} />
              </button>
            </div>

            {/* Error message */}
            {categoryModal.errorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0" />
                <span>{categoryModal.errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSaveCategoryModal} className="space-y-4">
              {/* Persian Title */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">
                  عنوان فارسی دسته‌بندی <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثلاً: آموزش و تدریس خصوصی"
                  value={categoryModal.fa}
                  onChange={(e) => setCategoryModal(prev => ({ ...prev, fa: e.target.value, errorMsg: '' }))}
                  className="w-full h-11 rounded-xl bg-stone-50 hover:bg-stone-100/70 focus:bg-white border border-stone-200 px-3.5 text-xs text-stone-900 placeholder:text-stone-400 focus:border-stone-400 focus:outline-none transition-all shadow-2xs"
                />
              </div>

              {/* Slug */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">
                  شناسه یکتا (حروف انگلیسی) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  disabled={categoryModal.mode === 'edit'}
                  placeholder="utbildning یا services"
                  value={categoryModal.id}
                  onChange={(e) => setCategoryModal(prev => ({ ...prev, id: e.target.value, errorMsg: '' }))}
                  className={`w-full h-11 rounded-xl border border-stone-200 px-3.5 text-xs font-mono text-left focus:outline-none transition-all shadow-2xs ${
                    categoryModal.mode === 'edit'
                      ? 'bg-stone-100 text-stone-500 cursor-not-allowed'
                      : 'bg-stone-50 hover:bg-stone-100/70 focus:bg-white text-stone-900 focus:border-stone-400'
                  }`}
                  dir="ltr"
                />
                <span className="text-[10.5px] text-stone-400 block mt-1">
                  شناسه انگلیسی در دیتابیس و لینک‌ها ذخیره می‌شود و پس از ایجاد قابل تغییر نیست.
                </span>
              </div>

              {/* Icon Picker */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-2">
                  انتخاب آیکون نمایشی
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 max-h-48 overflow-y-auto no-scrollbar p-1">
                  {AVAILABLE_CATEGORY_ICONS.map(item => {
                    const Icon = CATEGORY_ICON_MAP[item.name] || Tag;
                    const isSelected = categoryModal.icon === item.name;

                    return (
                      <button
                        key={item.name}
                        type="button"
                        onClick={() => setCategoryModal(prev => ({ ...prev, icon: item.name }))}
                        className={`flex flex-col items-center justify-center p-2.5 rounded-xl border transition-all cursor-pointer select-none active:scale-95 ${
                          isSelected
                            ? 'bg-blue-50 border-blue-600 text-blue-700 shadow-2xs ring-1 ring-blue-600'
                            : 'bg-stone-50 hover:bg-stone-100/80 border-stone-200 text-stone-600'
                        }`}
                        title={item.label}
                      >
                        <Icon size={20} />
                        <span className="text-[9.5px] mt-1 font-medium truncate w-full text-center">
                          {item.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Enabled toggle */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-stone-50 border border-stone-200/80">
                <div>
                  <span className="font-bold text-xs text-stone-800 block">وضعیت فعال‌بودن</span>
                  <span className="text-[11px] text-stone-400">امکان انتخاب در فرم ثبت آگهی و فیلترهای جستجو</span>
                </div>
                <input
                  type="checkbox"
                  checked={categoryModal.enabled}
                  onChange={(e) => setCategoryModal(prev => ({ ...prev, enabled: e.target.checked }))}
                  className="h-4 w-4 rounded border-stone-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setCategoryModal(prev => ({ ...prev, isOpen: false }))}
                  className="h-10 px-4 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-100 font-bold text-xs cursor-pointer active:scale-95 transition-all"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="h-10 px-5 rounded-xl bg-slate-900 hover:bg-black text-white font-bold text-xs cursor-pointer shadow-2xs active:scale-95 transition-all"
                >
                  {categoryModal.mode === 'add' ? 'افزودن دسته‌بندی' : 'ذخیره تغییرات'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          DELETE CATEGORY CONFIRMATION MODAL
      ======================================================== */}
      {categoryToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md font-vazir animate-in fade-in duration-150 select-none" dir="rtl">
          <div 
            className="fixed inset-0"
            onClick={() => setCategoryToDelete(null)}
          />

          <div className="relative z-10 w-full max-w-md bg-white rounded-3xl border border-stone-200 shadow-2xl p-6 text-right space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 border border-rose-200/80">
                <Trash2 size={22} />
              </div>
              <div>
                <h3 className="font-extrabold text-[16px] text-stone-900 tracking-tight">
                  حذف دسته‌بندی «{categoryToDelete.fa}»
                </h3>
                <p className="text-xs text-stone-400 mt-0.5">
                  شناسه: #{categoryToDelete.id}
                </p>
              </div>
            </div>

            {(categoryCounts[categoryToDelete.id] || 0) > 0 ? (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-800 text-xs space-y-1">
                <p className="font-bold">
                  توجه: این دسته‌بندی دارای {categoryCounts[categoryToDelete.id] || 0} آگهی ثبت‌شده است!
                </p>
                <p className="text-[11px] text-amber-700">
                  در صورت حذف، آگهی‌های این دسته بدون تغییر در دیتابیس باقی می‌مانند اما دسته‌بندی آن‌ها ممکن است در سایت نمایش داده نشود.
                </p>
              </div>
            ) : (
              <p className="text-xs text-stone-600">
                آیا از حذف این دسته‌بندی مطمئن هستید؟ این عملیات قابل بازگشت نیست.
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCategoryToDelete(null)}
                className="h-10 px-4 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-100 font-bold text-xs cursor-pointer active:scale-95 transition-all"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleDeleteCategoryConfirm}
                className="h-10 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs cursor-pointer shadow-2xs active:scale-95 transition-all"
              >
                حذف قطعی دسته
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          CITY ADD / EDIT MODAL
      ======================================================== */}
      {cityModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-[2px] animate-in fade-in duration-150 font-vazir" dir="rtl">
          <div className="fixed inset-0" onClick={() => setCityModal(prev => ({ ...prev, isOpen: false }))} />
          <div className="relative z-10 w-full max-w-md bg-white rounded-3xl border border-stone-200 shadow-2xl p-6 text-right space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-200/60">
                  <MapPin size={19} />
                </div>
                <div>
                  <h3 className="font-extrabold text-[15px] text-stone-900">
                    {cityModal.mode === 'add' ? 'افزودن شهر جدید' : 'ویرایش مشخصات شهر'}
                  </h3>
                  <p className="text-[11px] text-stone-500">
                    کشور: {countriesList.find(c => c.id === cityModal.countryId)?.nameFa}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCityModal(prev => ({ ...prev, isOpen: false }))}
                className="h-8 w-8 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-500 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {cityModal.errorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
                {cityModal.errorMsg}
              </div>
            )}

            <form onSubmit={handleSaveCityModal} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">نام فارسی شهر</label>
                <input
                  type="text"
                  placeholder="مثال: اوسترشوند"
                  value={cityModal.fa}
                  onChange={(e) => setCityModal(prev => ({ ...prev, fa: e.target.value, errorMsg: '' }))}
                  className="w-full h-10 rounded-xl bg-stone-50 focus:bg-white border border-stone-200 px-3 text-xs text-zinc-900 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">نام لاتین شهر (برای ذخیره و جستجو)</label>
                <input
                  type="text"
                  dir="ltr"
                  placeholder="مثال: استکهلم (به حروف لاتین)"
                  value={cityModal.id}
                  onChange={(e) => setCityModal(prev => ({ ...prev, id: e.target.value, errorMsg: '' }))}
                  className="w-full h-10 rounded-xl bg-stone-50 focus:bg-white border border-stone-200 px-3 text-xs font-mono text-zinc-900 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer select-none p-2.5 rounded-xl bg-stone-50 border border-stone-200/80">
                <input
                  type="checkbox"
                  checked={cityModal.enabled}
                  onChange={(e) => setCityModal(prev => ({ ...prev, enabled: e.target.checked }))}
                  className="rounded border-stone-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-xs font-bold text-stone-700">شهر در فرم ثبت آگهی و فیلترها فعال باشد</span>
              </label>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCityModal(prev => ({ ...prev, isOpen: false }))}
                  className="h-10 px-4 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-100 font-bold text-xs cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="h-10 px-5 rounded-xl bg-slate-900 hover:bg-black text-white font-bold text-xs cursor-pointer active:scale-95 transition-all"
                >
                  {cityModal.mode === 'add' ? 'افزودن شهر' : 'ذخیره تغییرات'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          DELETE CITY CONFIRMATION MODAL
      ======================================================== */}
      {cityToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-[2px] animate-in fade-in duration-150 font-vazir" dir="rtl">
          <div className="fixed inset-0" onClick={() => setCityToDelete(null)} />
          <div className="relative z-10 w-full max-w-md bg-white rounded-3xl border border-stone-200 shadow-2xl p-6 text-right space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 border border-rose-200/80">
                <Trash2 size={22} />
              </div>
              <div>
                <h3 className="font-extrabold text-[16px] text-stone-900 tracking-tight">
                  حذف شهر «{cityToDelete.fa}»
                </h3>
                <p dir="ltr" className="text-xs text-stone-400 font-mono mt-0.5 text-right">
                  {cityToDelete.id}
                </p>
              </div>
            </div>
            <p className="text-xs text-stone-600">
              آیا از حذف این شهر مطمئن هستید؟ این عملیات قابل بازگشت نیست.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCityToDelete(null)}
                className="h-10 px-4 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-100 font-bold text-xs cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteCity}
                className="h-10 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs cursor-pointer active:scale-95"
              >
                حذف قطعی شهر
              </button>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}
