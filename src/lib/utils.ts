import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Product, FlattenedProduct, ProductVariant } from "../types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Get the primary variant of a product (first active variant).
 * Returns undefined if the product has no variants.
 */
export function getPrimaryVariant(product: Product): ProductVariant | undefined {
  if (!product.hasVariants || !product.variants || product.variants.length === 0) {
    return undefined;
  }
  // Return the first active variant as the primary one
  return product.variants.find(v => v.isActive) || product.variants[0];
}

/**
 * Get the display barcode for a product.
 * For products with variants, returns the primary variant's barcode.
 * For regular products, returns the product's own barcode.
 */
export function getProductDisplayBarcode(product: Product): string | undefined {
  if (product.hasVariants && product.variants && product.variants.length > 0) {
    const primaryVariant = getPrimaryVariant(product);
    return primaryVariant?.barcode || product.barcode;
  }
  return product.barcode;
}

/**
 * Flatten products to treat each variant as a distinct line item.
 * - Products without variants are included as-is.
 * - Products with variants are expanded: each active variant becomes a separate entry.
 */
export function flattenProducts(products: Product[]): FlattenedProduct[] {
  const result: FlattenedProduct[] = [];

  for (const product of products) {
    if (product.hasVariants && product.variants && product.variants.length > 0) {
      // Expand each variant as a separate entry
      for (const variant of product.variants) {
        if (!variant.isActive) continue;

        // Build variant label from size and/or color
        const labelParts: string[] = [];
        if (variant.size) labelParts.push(variant.size);
        if (variant.color) labelParts.push(variant.color);
        const variantLabel = labelParts.join(' - ');
        
        // Check if variant has a discounted price
        const hasDiscount = !!(variant.discountedPrice && variant.discountedPrice > 0 && variant.discountedPrice < variant.retailPrice);

        const flatProduct: FlattenedProduct = {
          flatId: `${product.id}__${variant.id}`,
          product,
          variant,
          displayName: variantLabel ? `${product.name} (${variantLabel})` : product.name,
          displaySku: variant.sku,
          displayBarcode: variant.barcode || product.barcode,
          costPrice: variant.costPrice,
          wholesalePrice: variant.wholesalePrice,
          retailPrice: variant.retailPrice,
          discountedPrice: variant.discountedPrice,
          stock: variant.stock,
          minStock: variant.minStock,
          isVariant: true,
          variantLabel,
          hasDiscount,
        };
        result.push(flatProduct);
      }
    } else {
      // Non-variant product: include as single entry
      // Check if product has a discounted price
      const hasDiscount = !!(product.discountedPrice && product.discountedPrice > 0 && product.discountedPrice < (product.retailPrice || product.price || 0));
      
      const flatProduct: FlattenedProduct = {
        flatId: product.id,
        product,
        variant: undefined,
        displayName: product.name,
        displaySku: product.sku,
        displayBarcode: product.barcode,
        costPrice: product.costPrice || 0,
        wholesalePrice: product.wholesalePrice || product.price || 0,
        retailPrice: product.retailPrice || product.price || 0,
        discountedPrice: product.discountedPrice,
        stock: product.stock,
        minStock: product.minStock || 0,
        isVariant: false,
        variantLabel: undefined,
        hasDiscount,
      };
      result.push(flatProduct);
    }
  }

  return result;
}
