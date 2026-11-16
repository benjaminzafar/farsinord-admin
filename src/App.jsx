import React from 'react';
import AdminPanel from './components/AdminPanel';
import ErrorBoundary from './components/ErrorBoundary';
import { getMainSiteUrl } from './lib/apiClient';

export default function App() {
  const handleGoToMainSite = () => {
    const mainUrl = getMainSiteUrl();
    if (mainUrl && mainUrl !== '/') {
      window.location.href = mainUrl;
    } else {
      window.location.href = import.meta.env.VITE_MAIN_SITE_URL || 'https://swedpersiska.vercel.app';
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-[#f4f1ea] font-vazir" dir="rtl">
      <ErrorBoundary>
        <AdminPanel
          onClose={handleGoToMainSite}
          onRefreshAds={() => {}}
        />
      </ErrorBoundary>
    </div>
  );
}
