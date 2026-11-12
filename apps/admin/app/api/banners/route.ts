import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';
import { prisma } from '@kandy-cabs/db';

export const dynamic = 'force-dynamic';

interface BannerItem {
  id: string;
  badge?: string;
  tagline?: string;
  subTagline?: string;
  image: string;
  btnText: string;
  category?: string;
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
    id: 'banner-ev-cab',
    badge: 'COMING SOON',
    tagline: 'EV Cab Service',
    subTagline: 'Smart Rides - Happy Rides',
    image: '/images/banner-ev-cab.jpg',
    btnText: 'Coming Soon',
    category: 'LOCAL',
    bannerType: 'PROMO_GRAPHIC',
    showTextOverlay: false,
    showCtaButton: false,
    linkUrl: '',
    isActive: true,
    order: 1,
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
    bannerType: 'PROMO_GRAPHIC',
    showTextOverlay: false,
    showCtaButton: false,
    linkUrl: '',
    isActive: true,
    order: 2,
    createdAt: new Date().toISOString(),
  },
];

const ROOT_DATA_FILE = path.join(process.cwd(), '..', '..', '.banners_store.json');
const ADMIN_DATA_FILE = path.join(process.cwd(), '.banners_store.json');
const WEB_DATA_FILE = path.join(process.cwd(), '..', 'web', '.banners_store.json');
const TMP_DATA_FILE = path.join('/tmp', '.banners_store.json');

async function getStoredBanners(): Promise<BannerItem[]> {
  // 1. Try DB first (persisted across serverless Vercel deployments)
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: 'banners' },
    });
    if (setting && Array.isArray(setting.value) && (setting.value as any[]).length > 0) {
      return setting.value as unknown as BannerItem[];
    }
  } catch (err) {
    console.error('Error fetching banners from systemSetting DB:', err);
  }

  // 2. Fallback to local files
  const possiblePaths = [TMP_DATA_FILE, ROOT_DATA_FILE, ADMIN_DATA_FILE, WEB_DATA_FILE];
  for (const p of possiblePaths) {
    try {
      if (fs.existsSync(p)) {
        const data = fs.readFileSync(p, 'utf-8');
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {}
  }
  return DEFAULT_BANNERS;
}

function setCorsHeaders(res: NextResponse) {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Date, X-Api-Version'
  );
  return res;
}

export async function OPTIONS() {
  const res = new NextResponse(null, { status: 200 });
  return setCorsHeaders(res);
}

// GET /api/banners
export async function GET(req: NextRequest) {
  try {
    const banners = await getStoredBanners();
    const sorted = [...banners]
      .filter((b) => b.isActive)
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    const res = NextResponse.json({ success: true, banners: sorted }, { status: 200 });
    return setCorsHeaders(res);
  } catch (error) {
    console.error('Error fetching public banners:', error);
    const res = NextResponse.json({ success: true, banners: DEFAULT_BANNERS }, { status: 200 });
    return setCorsHeaders(res);
  }
}
