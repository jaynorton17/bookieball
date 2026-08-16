declare module 'compression' {
  import type { RequestHandler } from 'express';
  type Filter = (req: import('express').Request, res: import('express').Response) => boolean;
  type Options = { threshold?: number | string; filter?: Filter; level?: number };
  function compression(options?: Options): RequestHandler;
  export default compression;
}
