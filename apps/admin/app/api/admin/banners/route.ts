import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

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
    bannerType: 'APP_BANNER',
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

function getStoredBanners(): BannerItem[] {
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
    } catch (err) {
      console.error(`Error reading banner store from ${p}:`, err);
    }
  }
  return DEFAULT_BANNERS;
}

function saveStoredBanners(banners: BannerItem[]) {
  const jsonStr = JSON.stringify(banners, null, 2);
  const targets = [TMP_DATA_FILE, ROOT_DATA_FILE, ADMIN_DATA_FILE, WEB_DATA_FILE];
  for (const target of targets) {
    try {
      const dir = path.dirname(target);
      if (!fs.existsSync(dir)) {
        try {
          fs.mkdirSync(dir, { recursive: true });
        } catch {}
      }
      if (fs.existsSync(dir)) {
        fs.writeFileSync(target, jsonStr, 'utf-8');
      }
    } catch (err) {
      console.error(`Error saving banner file store to ${target}:`, err);
    }
  }
}

// GET /api/admin/banners
export async function GET(req: NextRequest) {
  try {
    const banners = getStoredBanners();
    const sorted = [...banners].sort((a, b) => (a.order || 0) - (b.order || 0));
    return NextResponse.json({ banners: sorted }, { status: 200 });
  } catch (error) {
    console.error('Error fetching banners:', error);
    return NextResponse.json({ banners: DEFAULT_BANNERS }, { status: 200 });
  }
}

// POST /api/admin/banners (Create or Update)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, badge, tagline, subTagline, image, btnText, category, bannerType, showTextOverlay, showCtaButton, linkUrl, isActive, order } = body;

    if (!image) {
      return NextResponse.json(
        { error: 'Banner image is required.' },
        { status: 400 }
      );
    }

    let banners = getStoredBanners();
    const resolvedType = bannerType || (tagline ? 'APP_BANNER' : 'PROMO_GRAPHIC');
    const resolvedShowOverlay = showTextOverlay !== undefined ? showTextOverlay : (resolvedType === 'APP_BANNER');
    const resolvedShowCta = showCtaButton !== undefined ? showCtaButton : Boolean(btnText);
    const resolvedLinkUrl = (linkUrl || '').trim();

    if (id) {
      // Update existing
      const index = banners.findIndex((b) => b.id === id);
      if (index !== -1) {
        banners[index] = {
          ...banners[index],
          badge: badge !== undefined ? badge : banners[index].badge,
          tagline: tagline !== undefined ? tagline : banners[index].tagline,
          subTagline: subTagline !== undefined ? subTagline : banners[index].subTagline,
          image: image || banners[index].image,
          btnText: btnText !== undefined ? btnText : banners[index].btnText,
          category: category !== undefined ? category : banners[index].category,
          bannerType: resolvedType,
          showTextOverlay: resolvedShowOverlay,
          showCtaButton: resolvedShowCta,
          linkUrl: resolvedLinkUrl,
          isActive: isActive !== undefined ? isActive : banners[index].isActive,
          order: order !== undefined ? Number(order) : banners[index].order,
        };
      } else {
        banners.push({
          id,
          badge: badge || '',
          tagline: tagline || '',
          subTagline: subTagline || '',
          image,
          btnText: btnText !== undefined ? btnText : 'Book Now',
          category: category || 'ONEWAY',
          bannerType: resolvedType,
          showTextOverlay: resolvedShowOverlay,
          showCtaButton: resolvedShowCta,
          linkUrl: resolvedLinkUrl,
          isActive: isActive !== undefined ? isActive : true,
          order: order !== undefined ? Number(order) : banners.length + 1,
          createdAt: new Date().toISOString(),
        });
      }
    } else {
      // Create new
      const newBanner: BannerItem = {
        id: `banner-${Date.now()}`,
        badge: badge || '',
        tagline: tagline || '',
        subTagline: subTagline || '',
        image,
        btnText: btnText !== undefined ? btnText : 'Book Now',
        category: category || 'ONEWAY',
        bannerType: resolvedType,
        showTextOverlay: resolvedShowOverlay,
        showCtaButton: resolvedShowCta,
        linkUrl: resolvedLinkUrl,
        isActive: isActive !== undefined ? isActive : true,
        order: order !== undefined ? Number(order) : banners.length + 1,
        createdAt: new Date().toISOString(),
      };
      banners.push(newBanner);
    }

    saveStoredBanners(banners);
    return NextResponse.json({ success: true, banners }, { status: 200 });
  } catch (error: any) {
    console.error('Error saving banner:', error);
    return NextResponse.json({ error: error.message || 'Failed to save banner' }, { status: 500 });
  }
}

// DELETE /api/admin/banners
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Banner ID is required' }, { status: 400 });
    }

    let banners = getStoredBanners();
    banners = banners.filter((b) => b.id !== id);
    saveStoredBanners(banners);

    return NextResponse.json({ success: true, banners }, { status: 200 });
  } catch (error: any) {
    console.error('Error deleting banner:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete banner' }, { status: 500 });
  }
}
