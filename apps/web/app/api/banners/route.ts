import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { setCorsHeaders, handleOptions } from '@/lib/cors';

export const dynamic = 'force-dynamic';

export interface BannerItem {
  id: string;
  badge?: string;
  tagline?: string;
  subTagline?: string;
  image: string;
  btnText: string;
  category?: 'ONEWAY' | 'ROUND' | 'AIRPORT' | 'LOCAL' | 'CORPORATE' | 'TOUR';
  bannerType?: 'APP_BANNER' | 'PROMO_GRAPHIC';
  showTextOverlay?: boolean;
  showCtaButton?: boolean;
  linkUrl?: string;
  isActive: boolean;
  order: number;
  createdAt: string;
}

const DEFAULT_BANNERS: BannerItem[] = [
  {
    id: 'banner-deepawali',
    badge: 'SPECIAL OFFER',
    tagline: 'Deepawali Special Offer',
    subTagline: 'Use Coupon Code KCD500 • Get ₹500 OFF',
    image: '/images/banner-deepawali.jpg',
    btnText: 'Use Code: KCD500',
    category: 'ROUND',
    bannerType: 'APP_BANNER',
    showTextOverlay: false,
    showCtaButton: false,
    linkUrl: '',
    isActive: true,
    order: 1,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'banner-christmas',
    badge: 'SPECIAL OFFER',
    tagline: 'Merry Christmas Special Offer',
    subTagline: 'Use Coupon Code KCMC25 • Get ₹250 OFF on One Way Drop',
    image: '/images/banner-christmas.jpg',
    btnText: 'Use Code: KCMC25',
    category: 'ONEWAY',
    bannerType: 'APP_BANNER',
    showTextOverlay: false,
    showCtaButton: false,
    linkUrl: '',
    isActive: true,
    order: 2,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'banner-ev-cab',
    badge: 'COMING SOON',
    tagline: 'EV Cab Service',
    subTagline: 'Smart Rides - Happy Rides',
    image: '/images/banner-ev-cab.jpg',
    btnText: 'Coming Soon',
    category: 'LOCAL',
    bannerType: 'APP_BANNER',
    showTextOverlay: false,
    showCtaButton: false,
    linkUrl: '',
    isActive: true,
    order: 3,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'banner-1',
    badge: 'OUTSTATION ROUND TRIP',
    tagline: 'Coorg - Madikeri',
    subTagline: 'Scenic Drives • Coffee Estates • Waterfalls',
    image: '/images/banner-coorg.jpg',
    btnText: 'Book Outstation',
    category: 'ROUND',
    bannerType: 'APP_BANNER',
    showTextOverlay: false,
    showCtaButton: false,
    linkUrl: '',
    isActive: true,
    order: 4,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'banner-2',
    badge: 'AIRPORT TRANSFERS',
    tagline: 'Mangaluru & Bengaluru Airports',
    subTagline: 'Zero Surge • 24/7 Guaranteed Pickup',
    image: '/images/banner-airport.jpg',
    btnText: 'Book Airport Cab',
    category: 'AIRPORT',
    bannerType: 'APP_BANNER',
    showTextOverlay: false,
    showCtaButton: false,
    linkUrl: '',
    isActive: true,
    order: 5,
    createdAt: new Date().toISOString(),
  },
];

const ROOT_DATA_FILE = path.join(process.cwd(), '..', '..', '.banners_store.json');
const WEB_DATA_FILE = path.join(process.cwd(), '.banners_store.json');
const ADMIN_DATA_FILE = path.join(process.cwd(), '..', 'admin', '.banners_store.json');

function getStoredBanners(): BannerItem[] {
  const possiblePaths = [ROOT_DATA_FILE, WEB_DATA_FILE, ADMIN_DATA_FILE];
  for (const p of possiblePaths) {
    try {
      if (fs.existsSync(p)) {
        const data = fs.readFileSync(p, 'utf-8');
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (err) {
      console.error(`Error reading banner store from ${p}:`, err);
    }
  }
  return DEFAULT_BANNERS;
}

export async function OPTIONS() {
  return handleOptions();
}

// GET /api/banners
export async function GET() {
  try {
    const banners = getStoredBanners();
    const sorted = [...banners]
      .filter((b) => b.isActive)
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    const res = NextResponse.json({ success: true, banners: sorted }, { status: 200 });
    return setCorsHeaders(res);
  } catch (error: any) {
    console.error('Error fetching public banners:', error);
    const res = NextResponse.json({ success: true, banners: DEFAULT_BANNERS }, { status: 200 });
    return setCorsHeaders(res);
  }
}
