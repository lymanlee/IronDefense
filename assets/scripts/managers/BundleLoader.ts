/**
 * BundleLoader.ts - cached Asset Bundle loading with resources fallback.
 */

import { Asset, AssetManager, assetManager, resources } from 'cc';

type BundleName = 'game' | 'battle' | 'audio';

export class BundleLoader {
  private static readonly _bundles: Partial<Record<BundleName, AssetManager.Bundle>> = {};
  private static readonly _pending: Partial<Record<BundleName, Array<(bundle: AssetManager.Bundle | null) => void>>> = {};

  static loadAsset<T extends Asset>(
    bundleName: BundleName,
    path: string,
    type: new (...args: any[]) => T,
    callback: (err: Error | null, asset: T | null) => void
  ): void {
    this.loadBundle(bundleName, (bundle) => {
      if (!bundle) {
        resources.load(path, type, (err, asset) => callback(err || null, asset || null));
        return;
      }
      bundle.load(path, type, (err, asset) => {
        if (err) {
          resources.load(path, type, (fallbackErr, fallbackAsset) => callback(fallbackErr || err, fallbackAsset || null));
          return;
        }
        callback(null, asset || null);
      });
    });
  }

  static loadDir<T extends Asset>(
    bundleName: BundleName,
    path: string,
    type: new (...args: any[]) => T,
    callback: (err: Error | null, assets: T[] | null) => void
  ): void {
    this.loadBundle(bundleName, (bundle) => {
      if (!bundle) {
        resources.loadDir(path, type, (err, assets) => callback(err || null, assets || null));
        return;
      }
      bundle.loadDir(path, type, (err, assets) => {
        if (err) {
          resources.loadDir(path, type, (fallbackErr, fallbackAssets) => callback(fallbackErr || err, fallbackAssets || null));
          return;
        }
        callback(null, assets || null);
      });
    });
  }

  private static loadBundle(bundleName: BundleName, callback: (bundle: AssetManager.Bundle | null) => void): void {
    const cached = this._bundles[bundleName];
    if (cached) {
      callback(cached);
      return;
    }

    const pending = this._pending[bundleName];
    if (pending) {
      pending.push(callback);
      return;
    }

    this._pending[bundleName] = [callback];
    assetManager.loadBundle(bundleName, (err, bundle) => {
      if (err || !bundle) {
        console.warn(`[BundleLoader] load bundle ${bundleName} failed, fallback to resources:`, err);
      } else {
        this._bundles[bundleName] = bundle;
      }

      const callbacks = this._pending[bundleName] || [];
      delete this._pending[bundleName];
      callbacks.forEach(item => item(bundle || null));
    });
  }
}
