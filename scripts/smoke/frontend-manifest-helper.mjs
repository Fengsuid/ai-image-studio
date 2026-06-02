import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const HASHED_JS_ENTRY = /^\/dist\/[a-z0-9][a-z0-9-]*\.[a-f0-9]{12}\.js$/;

function normalizeSource(source) {
  const value = String(source || "").split("#")[0].split("?")[0];
  return value.startsWith("/") ? value : `/${value}`;
}

function publicFile(rootDir, publicPath) {
  const normalized = normalizeSource(publicPath);
  return path.join(rootDir, "public", normalized.slice(1));
}

function assertHashedJsAsset(asset, label) {
  assert(asset?.source, `frontend manifest must include source for ${label}`);
  assert.match(asset.entry || "", HASHED_JS_ENTRY, `${label} must resolve to a hashed /dist/*.js entry`);
  assert(fs.existsSync(publicFile(asset.rootDir, asset.entry)), `${label} hashed JS bundle must exist`);
  return asset;
}

export function createFrontendManifestHelper(rootDir) {
  const manifestPath = path.join(rootDir, "public/frontend-build-manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const assets = Array.isArray(manifest.js?.assets) ? manifest.js.assets : [];
  const assetsBySource = new Map(assets.map((asset) => [normalizeSource(asset.source), { ...asset, rootDir }]));

  function assetBySource(source) {
    const normalized = normalizeSource(source);
    return assertHashedJsAsset(assetsBySource.get(normalized), normalized);
  }

  function assetByFileName(fileName) {
    const matches = assets
      .filter((asset) => path.posix.basename(normalizeSource(asset.source)) === fileName)
      .map((asset) => ({ ...asset, rootDir }));
    assert.equal(matches.length, 1, `frontend manifest must include one JS asset named ${fileName}`);
    return assertHashedJsAsset(matches[0], fileName);
  }

  function lazyRouteSources(routeName) {
    const scripts = manifest.js?.lazyRoutes?.[routeName]?.scripts || [];
    assert(Array.isArray(scripts), `frontend manifest must expose ${routeName} lazy route scripts`);
    return scripts.map(normalizeSource);
  }

  function lazyRouteAssetByFileName(routeName, fileName) {
    const source = lazyRouteSources(routeName).find((script) => path.posix.basename(script) === fileName);
    assert(source, `frontend manifest ${routeName} lazy route must include ${fileName}`);
    return assetBySource(source);
  }

  function lazyRouteIndexByFileName(routeName, fileName) {
    return lazyRouteSources(routeName).findIndex((script) => path.posix.basename(script) === fileName);
  }

  function readPublicSourceForAsset(asset) {
    return fs.readFileSync(publicFile(rootDir, asset.source), "utf8");
  }

  function readBuiltAsset(asset) {
    return fs.readFileSync(publicFile(rootDir, asset.entry), "utf8");
  }

  return {
    manifest,
    assetByFileName,
    assetBySource,
    lazyRouteAssetByFileName,
    lazyRouteIndexByFileName,
    lazyRouteSources,
    readBuiltAsset,
    readPublicSourceForAsset
  };
}
