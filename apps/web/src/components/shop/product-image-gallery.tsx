'use client';

import { useState } from 'react';
import Image from 'next/image';
import { X, ZoomIn } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';

interface ProductImageGalleryProps {
  images: string[];
  name: string;
}

export function ProductImageGallery({ images, name }: ProductImageGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  if (!images || images.length === 0) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-lg bg-muted text-muted-foreground">
        No image available
      </div>
    );
  }

  const currentImage = images[selectedIndex];

  return (
    <div className="space-y-3">
      {/* Main image */}
      <div
        className="group relative aspect-square cursor-zoom-in overflow-hidden rounded-lg bg-muted"
        onClick={() => images.length > 0 && setLightboxOpen(true)}
      >
        {currentImage && (
          <Image
            src={currentImage}
            alt={`${name} - image ${selectedIndex + 1}`}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, 50vw"
            priority
          />
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-opacity group-hover:opacity-100">
          <ZoomIn className="size-10 text-white drop-shadow-lg" />
        </div>
      </div>

      {/* Thumbnail strip */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((img, idx) => (
            <button
              key={idx}
              onClick={() => setSelectedIndex(idx)}
              className={`relative aspect-square w-16 shrink-0 overflow-hidden rounded-md border-2 transition-colors ${
                idx === selectedIndex
                  ? 'border-primary'
                  : 'border-transparent hover:border-muted-foreground/40'
              }`}
            >
              <Image
                src={img}
                alt={`${name} thumbnail ${idx + 1}`}
                fill
                className="object-cover"
                sizes="64px"
              />
            </button>
          ))}
        </div>
      )}

      {/* Lightbox */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-4xl border-none bg-black/95 p-0">
          <DialogTitle className="sr-only">{name} - Full size image</DialogTitle>
          <div className="relative flex aspect-square items-center justify-center">
            {currentImage && (
              <Image
                src={currentImage}
                alt={`${name} - full size`}
                fill
                className="object-contain"
                sizes="(max-width: 1024px) 100vw, 80vw"
                priority
              />
            )}
          </div>

          {/* Lightbox thumbnails */}
          {images.length > 1 && (
            <div className="flex justify-center gap-2 bg-black/95 px-4 pb-4">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedIndex(idx)}
                  className={`relative aspect-square w-14 shrink-0 overflow-hidden rounded-md border-2 ${
                    idx === selectedIndex ? 'border-white' : 'border-white/30'
                  }`}
                >
                  <Image
                    src={img}
                    alt={`Thumbnail ${idx + 1}`}
                    fill
                    className="object-cover"
                    sizes="56px"
                  />
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}