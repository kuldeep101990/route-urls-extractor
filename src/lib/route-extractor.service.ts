import { Injectable, Inject, Compiler, Injector } from '@angular/core';
import { Router, Routes, ROUTES } from '@angular/router';
import { ExtractedRoute } from './route-extractor.models';

@Injectable({
  providedIn: 'root'
})
export class RouteExtractorService {
  constructor(
    private router: Router,
    private compiler: Compiler,
    private injector: Injector
  ) {}

  /**
   * Extracts all routes, optionally resolving lazy loaded modules.
   */
  public async extractRoutes(resolveLazy: boolean = false): Promise<ExtractedRoute[]> {
    return this.parseRoutes(this.router.config, '', resolveLazy);
  }

  private async parseRoutes(routes: Routes, parentPath: string = '', resolveLazy: boolean): Promise<ExtractedRoute[]> {
    const extracted: ExtractedRoute[] = [];

    for (const route of routes) {
      if (route.redirectTo) continue; // Skip redirects

      const currentPath = route.path ? route.path : '';
      const absolutePath = this.buildAbsolutePath(parentPath, currentPath);
      
      const extractedRoute: ExtractedRoute = {
        path: currentPath,
        absolutePath: absolutePath,
        isLazy: !!route.loadChildren
      };

      if (route.children) {
        extractedRoute.children = await this.parseRoutes(route.children, absolutePath, resolveLazy);
      } else if (route.loadChildren && resolveLazy) {
        const lazyRoutes = await this.resolveLazyRoutes(route.loadChildren);
        extractedRoute.children = await this.parseRoutes(lazyRoutes, absolutePath, resolveLazy);
      }

      extracted.push(extractedRoute);
    }

    return extracted;
  }

  private async resolveLazyRoutes(loadChildren: any): Promise<Routes> {
    try {
      if (typeof loadChildren === 'string') {
        console.warn('String-based loadChildren is deprecated. Dynamic import() is required.');
        return [];
      }

      const loaded = await loadChildren();

      if (Array.isArray(loaded)) {
        return loaded;
      }

      if (loaded.default && Array.isArray(loaded.default)) {
        return loaded.default;
      }

      let moduleFactory;
      if (typeof loaded === 'function') {
         const moduleClass = this.extractModuleClass(loaded);
         if (moduleClass) {
             moduleFactory = await this.compiler.compileModuleAsync(moduleClass);
         }
      } else {
         const moduleClass = this.extractModuleClass(loaded);
         if (moduleClass) {
             moduleFactory = await this.compiler.compileModuleAsync(moduleClass);
         }
      }

      if (moduleFactory) {
        const moduleRef = moduleFactory.create(this.injector);
        const routesTokens = moduleRef.injector.get(ROUTES, []);
        return routesTokens.reduce((acc: Routes, val: Routes) => acc.concat(val), []);
      }

    } catch (e) {
      console.error('Failed to resolve lazy route', e);
    }
    
    return [];
  }

  private extractModuleClass(loadedExports: any): any {
    if (typeof loadedExports === 'function') return loadedExports;
    for (const key in loadedExports) {
      if (typeof loadedExports[key] === 'function') {
        return loadedExports[key];
      }
    }
    return null;
  }

  private buildAbsolutePath(parent: string, current: string): string {
    if (!parent) return `/${current}`;
    if (!current) return parent;
    return `${parent}/${current}`.replace(/\/\/+/g, '/');
  }
}
