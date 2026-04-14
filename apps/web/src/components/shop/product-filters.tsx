'use client';

import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

interface Category {
  id: string;
  name: string;
  description?: string;
  productCount: number;
}

interface ProductFiltersProps {
  categories: Category[];
  selectedCategory: string;
  onCategoryChange: (categoryId: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onClear: () => void;
}

export function ProductFilters({
  categories,
  selectedCategory,
  onCategoryChange,
  searchQuery,
  onSearchChange,
  onClear,
}: ProductFiltersProps) {
  return (
    <div className="space-y-6">
      {/* Search */}
      <div>
        <h3 className="mb-3 text-sm font-semibold">Search</h3>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-8"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      <Separator />

      {/* Categories */}
      <div>
        <h3 className="mb-3 text-sm font-semibold">Categories</h3>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id="cat-all"
              checked={selectedCategory === ''}
              onCheckedChange={() => onCategoryChange('')}
            />
            <Label htmlFor="cat-all" className="cursor-pointer text-sm">
              All Categories
            </Label>
          </div>
          {categories.map((cat) => (
            <div key={cat.id} className="flex items-center gap-2">
              <Checkbox
                id={`cat-${cat.id}`}
                checked={selectedCategory === cat.id}
                onCheckedChange={() => onCategoryChange(cat.id)}
              />
              <Label htmlFor={`cat-${cat.id}`} className="cursor-pointer text-sm">
                {cat.name}
                <span className="ml-1 text-xs text-muted-foreground">
                  ({cat.productCount})
                </span>
              </Label>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* Clear Filters */}
      {(selectedCategory || searchQuery) && (
        <Button variant="outline" size="sm" className="w-full" onClick={onClear}>
          <X className="mr-2 size-4" />
          Clear Filters
        </Button>
      )}
    </div>
  );
}