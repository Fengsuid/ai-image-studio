// SPDX-License-Identifier: AGPL-3.0-or-later
export function sortProjectsByRecent(projects) {
  return [...projects].sort((left, right) => {
    const leftTime = Date.parse(left.updatedAt ?? "");
    const rightTime = Date.parse(right.updatedAt ?? "");
    return (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0);
  });
}
