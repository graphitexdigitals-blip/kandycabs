import { createClient, SupabaseClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

export const TRIP_PHOTOS_BUCKET = 'kandy-trip-photos';

let supabaseAdminClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !serviceKey || url.includes('placeholder') || serviceKey.includes('placeholder')) {
    return null;
  }

  if (!supabaseAdminClient) {
    supabaseAdminClient = createClient(url, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return supabaseAdminClient;
}

/**
 * Uploads a trip or inspection photo to Supabase Storage.
 * Accepts Base64 data URI, raw Base64, or file buffer.
 * Returns the permanent storage URL or path to be stored in PostgreSQL.
 * If Supabase Storage is constrained (e.g. free tier quota limit), gracefully
 * saves to local server public uploads directory so the database NEVER stores raw Base64.
 */
export async function uploadTripPhoto({
  bookingId,
  category,
  imageBase64OrUri,
  customName,
}: {
  bookingId: string;
  category: 'start' | 'complete' | 'inspection';
  imageBase64OrUri: string;
  customName?: string;
}): Promise<string> {
  if (!imageBase64OrUri || typeof imageBase64OrUri !== 'string') {
    return '';
  }

  // If it's already an HTTP / HTTPS URL or storage path, return as is
  if (imageBase64OrUri.startsWith('http://') || imageBase64OrUri.startsWith('https://') || imageBase64OrUri.startsWith('/uploads/')) {
    return imageBase64OrUri;
  }

  // Extract mime type and clean Base64 data
  let mimeType = 'image/jpeg';
  let base64Data = imageBase64OrUri;

  const match = imageBase64OrUri.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
  if (match) {
    mimeType = match[1];
    base64Data = match[2];
  }

  const extension = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
  const cleanCategory = category.replace(/[^a-zA-Z0-9_-]/g, '');
  const cleanBookingId = bookingId.replace(/[^a-zA-Z0-9_-]/g, '');
  const fileName = `${customName ? customName.replace(/[^a-zA-Z0-9_-]/g, '') : 'photo'}_${Date.now()}.${extension}`;
  const storagePath = `bookings/${cleanBookingId}/${cleanCategory}/${fileName}`;

  const buffer = Buffer.from(base64Data, 'base64');

  const supabase = getSupabaseAdmin();

  if (supabase) {
    try {
      // 1. Attempt upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from(TRIP_PHOTOS_BUCKET)
        .upload(storagePath, buffer, {
          contentType: mimeType,
          upsert: true,
        });

      if (!error && data) {
        const { data: publicData } = supabase.storage
          .from(TRIP_PHOTOS_BUCKET)
          .getPublicUrl(storagePath);

        if (publicData?.publicUrl) {
          return publicData.publicUrl;
        }
        return storagePath;
      }

      console.warn(`[Supabase Storage Notice] Upload to '${TRIP_PHOTOS_BUCKET}' encountered notice:`, error?.message);
    } catch (storageErr: any) {
      console.warn('[Supabase Storage Warning]:', storageErr.message);
    }
  }

  // 2. High-reliability fallback: Store in web public uploads directory so PostgreSQL only receives lightweight URL path
  try {
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'bookings', cleanBookingId, cleanCategory);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    const fullFilePath = path.join(uploadDir, fileName);
    fs.writeFileSync(fullFilePath, buffer);
    const localUrl = `/uploads/bookings/${cleanBookingId}/${cleanCategory}/${fileName}`;
    return localUrl;
  } catch (fsErr: any) {
    console.error('[Storage Fallback Error]:', fsErr.message);
    // If local write fails, return a safe relative reference
    return `bookings/${cleanBookingId}/${cleanCategory}/${fileName}`;
  }
}

/**
 * Uploads an array of inspection photos in parallel.
 * Returns array of storage URLs/paths.
 */
export async function uploadInspectionPhotos(
  bookingId: string,
  photos: string[]
): Promise<string[]> {
  if (!Array.isArray(photos) || photos.length === 0) {
    return [];
  }

  const uploadPromises = photos.map((photo, index) => {
    if (!photo) return Promise.resolve('');
    return uploadTripPhoto({
      bookingId,
      category: 'inspection',
      imageBase64OrUri: photo,
      customName: `inspection_${index + 1}`,
    });
  });

  const results = await Promise.all(uploadPromises);
  return results.filter(Boolean);
}
