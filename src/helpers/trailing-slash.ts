import type { Request, Response, NextFunction } from "express";

/**
 * Redirects any request with a trailing slash to the clean path.
 * /health/ → 301 → /health
 * /users/?page=1 → 301 → /users?page=1
 */
export const stripTrailingSlash = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  if (req.path !== "/" && req.path.endsWith("/")) {
    const query = req.url.slice(req.path.length);
    res.redirect(301, req.path.slice(0, -1) + query);
    return;
  }
  next();
};
