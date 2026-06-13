export interface ExtractedRoute {
  path: string;
  absolutePath: string;
  isLazy: boolean;
  children?: ExtractedRoute[];
}
