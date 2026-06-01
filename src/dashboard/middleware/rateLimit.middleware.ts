import { Request, Response, NextFunction } from 'express';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 60000);

export function createRateLimiter(windowMs: number = 60000, max: number = 100) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const entry = rateLimitStore.get(key);

    if (!entry || now > entry.resetTime) {
      rateLimitStore.set(key, {
        count: 1,
        resetTime: now + windowMs
      });
      return next();
    }

    if (entry.count >= max) {
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfter);
      
      const isApiRequest = req.path.startsWith('/api/') || req.path.startsWith('/webhook/');
      
      if (isApiRequest) {
        return res.status(429).json({
          success: false,
          error: 'Too many requests',
          retryAfter
        });
      }
      
      return res.status(429).render('error', {
        user: req.user || null,
        title: 'Too Many Requests',
        error: { code: 429, message: `Слишком много запросов. Подождите ${retryAfter} секунд.` }
      });
    }

    entry.count++;
    next();
  };
}

export const strictRateLimiter = createRateLimiter(60000, 30); 
export const webhookRateLimiter = createRateLimiter(60000, 10); 
export const authRateLimiter = createRateLimiter(900000, 5);