// SPDX-License-Identifier: AGPL-3.0-or-later
// Project list feature: loading, filtering, and recency sorting for Canvas v2 projects.
// The API fetcher is injected by the caller so this module stays pure and adapter-free.

export async function loadProjects(fetchProjectList, { scope = "mine", limit = 50 } = {}) {
  const result = await fetchProjectList({ scope, limit });
  return filterProjects(result?.canvases);
}

export function filterProjects(canvases) {
  return Array.isArray(canvases) ? canvases : [];
}

export function sortProjectsByRecent(projects) {
  return [...projects].sort((left, right) => {
    const leftTime = Date.parse(left.updatedAt ?? "");
    const rightTime = Date.parse(right.updatedAt ?? "");
    return (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0);
  });
}

export function upsertProject(projects, canvas) {
  return sortProjectsByRecent([canvas, ...projects.filter((project) => project.id !== canvas.id)]);
}
