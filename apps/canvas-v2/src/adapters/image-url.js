// SPDX-License-Identifier: AGPL-3.0-or-later
export function canPersistImageUrl(imageUrl) {
  if (!imageUrl) return false;
  if (imageUrl.startsWith("data:") || imageUrl.startsWith("blob:")) return false;
  return imageUrl.startsWith("/") || imageUrl.startsWith("https://") || imageUrl.startsWith("http://");
}
