'use client';

import React from 'react';
import { Package } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProductThumbnailProps {
  imageUrl?: string;
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<ProductThumbnailProps['size']>, string> = {
  xs: 'h-5 w-5 rounded',
  sm: 'h-7 w-7 rounded-lg',
  md: 'h-9 w-9 rounded-xl',
  lg: 'h-12 w-12 rounded-xl',
};

const ICON_CLASSES: Record<NonNullable<ProductThumbnailProps['size']>, string> = {
  xs: 'h-3 w-3',
  sm: 'h-3.5 w-3.5',
  md: 'h-4.5 w-4.5',
  lg: 'h-5 w-5',
};

export function ProductThumbnail({
  imageUrl,
  name,
  size = 'sm',
  className,
}: ProductThumbnailProps) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name}
        className={cn(
          'shrink-0 object-cover border border-surface-200 bg-white',
          SIZE_CLASSES[size],
          className
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        'shrink-0 flex items-center justify-center bg-primary-50 text-primary-600 border border-primary-100',
        SIZE_CLASSES[size],
        className
      )}
      aria-label={name}
    >
      <Package className={ICON_CLASSES[size]} />
    </div>
  );
}

/**
 * Resize and compress an uploaded product image client-side so it fits
 * cleanly in Firestore documents and loads fast across all ERP tables.
 */
export function compressProductImage(file: File, maxDimension = 480, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image file'));
      img.onload = () => {
        const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

