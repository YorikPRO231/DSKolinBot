import { Request, Response, NextFunction } from 'express';
import { StatusCodes, ReasonPhrases } from 'http-status-codes';
import { PermissionsRepository } from '../../databases';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: any;
  public readonly isOperational: boolean;

  constructor(statusCode: number, message: string, code?: string, details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.code = code || getErrorCodeFromStatus(statusCode);
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string, code?: string, details?: any) {
    return new AppError(StatusCodes.BAD_REQUEST, message, code, details);
  }

  static unauthorized(message: string = ReasonPhrases.UNAUTHORIZED, code?: string) {
    return new AppError(StatusCodes.UNAUTHORIZED, message, code);
  }

  static forbidden(message: string = ReasonPhrases.FORBIDDEN, code?: string) {
    return new AppError(StatusCodes.FORBIDDEN, message, code);
  }

  static notFound(message: string = ReasonPhrases.NOT_FOUND, code?: string) {
    return new AppError(StatusCodes.NOT_FOUND, message, code);
  }

  static conflict(message: string, code?: string) {
    return new AppError(StatusCodes.CONFLICT, message, code);
  }

  static internal(message: string = ReasonPhrases.INTERNAL_SERVER_ERROR, code?: string) {
    return new AppError(StatusCodes.INTERNAL_SERVER_ERROR, message, code);
  }
}

function getErrorCodeFromStatus(statusCode: number): string {
  const codes: Record<number, string> = {
    400: 'BAD_REQUEST',
    401: 'UNAUTHORIZED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    409: 'CONFLICT',
    422: 'VALIDATION_ERROR',
    429: 'TOO_MANY_REQUESTS',
    500: 'INTERNAL_SERVER_ERROR',
    502: 'BAD_GATEWAY',
    503: 'SERVICE_UNAVAILABLE',
    504: 'GATEWAY_TIMEOUT'
  };
  return codes[statusCode] || 'UNKNOWN_ERROR';
}

function getErrorMessageFromStatus(statusCode: number): string {
  const messages: Record<number, string> = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    409: 'Conflict',
    422: 'Validation Error',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout'
  };
  return messages[statusCode] || 'An error occurred';
}

async function getUserPermissions(req: Request): Promise<string[]> {
  const userId = (req.user as any)?.id;
  if (!userId) return [];
  return PermissionsRepository.getUserPermissions(userId);
}

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  console.error('[ERROR HANDLER]', {
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    ip: req.ip,
    user: (req as any).user?.id || 'anonymous',
    error: {
      name: err.name,
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      code: err.code,
      statusCode: err.statusCode
    }
  });

  let statusCode = err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;

  if (err.name === 'ValidationError') {
    statusCode = StatusCodes.BAD_REQUEST;
  } else if (err.name === 'UnauthorizedError' || err.name === 'JsonWebTokenError') {
    statusCode = StatusCodes.UNAUTHORIZED;
  } else if (err.code === 'ECONNREFUSED') {
    statusCode = StatusCodes.BAD_GATEWAY;
  } else if (err.code === 'ETIMEDOUT') {
    statusCode = StatusCodes.GATEWAY_TIMEOUT;
  }

  const isApiRequest = req.path.startsWith('/api/') || req.path.startsWith('/webhook/') || req.xhr;

  const errorResponse = {
    success: false,
    error: {
      code: err.code || getErrorCodeFromStatus(statusCode),
      message: err.message || getErrorMessageFromStatus(statusCode),
      statusCode: statusCode,
      timestamp: new Date().toISOString(),
      path: req.path,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
      ...(err.details && { details: err.details })
    }
  };

  if (isApiRequest) {
    return res.status(statusCode).json(errorResponse);
  }

  getUserPermissions(req).then(permissions => {
    res.status(statusCode).render('error', {
      user: (req as any).user || null,
      title: `${statusCode} - ${getErrorMessageFromStatus(statusCode)}`,
      currentPage: 'error',
      permissions: permissions,
      error: {
        code: statusCode,
        message: err.message || getErrorMessageFromStatus(statusCode),
        description: getErrorDescription(statusCode, err),
        stack: process.env.NODE_ENV === 'development' ? err.stack : null
      }
    });
  }).catch(() => {
    res.status(statusCode).render('error', {
      user: (req as any).user || null,
      title: `${statusCode} - ${getErrorMessageFromStatus(statusCode)}`,
      currentPage: 'error',
      permissions: [],
      error: {
        code: statusCode,
        message: err.message || getErrorMessageFromStatus(statusCode),
        description: getErrorDescription(statusCode, err),
        stack: process.env.NODE_ENV === 'development' ? err.stack : null
      }
    });
  });
}

function getErrorDescription(statusCode: number, err: any): string {
  const descriptions: Record<number, string> = {
    400: 'Пожалуйста, проверьте введенные данные и попробуйте снова.',
    401: 'Пожалуйста, войдите в систему для доступа к этому ресурсу.',
    403: 'У вас нет прав для выполнения этого действия.',
    404: 'Проверьте URL или вернитесь на главную страницу.',
    409: 'Данные, которые вы пытаетесь изменить, уже существуют или конфликтуют с другими данными.',
    422: 'Пожалуйста, проверьте все поля формы на наличие ошибок.',
    429: 'Подождите несколько секунд перед повторной попыткой.',
    500: 'Технические неполадки или внутренняя ошибка. Пожалуйста, попробуйте позже.',
    502: 'Проблема с внешним сервисом. Попробуйте позже.',
    503: 'Сервер временно недоступен. Попробуйте позже.',
    504: 'Сервер не отвечает. Попробуйте позже.'
  };

  if (statusCode === 404 && err?.message?.includes('EJS')) {
    return 'Запрашиваемая страница не найдена. Проверьте URL.';
  }

  return descriptions[statusCode] || 'Пожалуйста, попробуйте позже или обратитесь к администратору.';
}

export function notFoundHandler(req: Request, res: Response, next: NextFunction) {
  const isApiRequest = req.path.startsWith('/api/') ||
                       req.path.startsWith('/webhook/') ||
                       req.xhr;

  if (isApiRequest) {
    return res.status(StatusCodes.NOT_FOUND).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Route ${req.method} ${req.path} not found`,
        statusCode: StatusCodes.NOT_FOUND,
        timestamp: new Date().toISOString(),
        path: req.path
      }
    });
  }

  const user = (req as any).user || null;
  const isAuthenticated = req.isAuthenticated && req.isAuthenticated();

  if (!isAuthenticated && req.path.startsWith('/dashboard')) {
    if (req.session) {
      req.session.returnTo = req.originalUrl;
    }
    return res.redirect('/login');
  }

  getUserPermissions(req).then(permissions => {
    res.status(StatusCodes.NOT_FOUND).render('error', {
      user: user,
      title: '404 - Page Not Found',
      currentPage: 'error',
      permissions: permissions,
      error: {
        code: 404,
        message: 'Страница не найдена',
        description: 'Запрашиваемая страница не существует или была перемещена'
      }
    });
  }).catch(() => {
    res.status(StatusCodes.NOT_FOUND).render('error', {
      user: user,
      title: '404 - Page Not Found',
      currentPage: 'error',
      permissions: [],
      error: {
        code: 404,
        message: 'Страница не найдена',
        description: 'Запрашиваемая страница не существует или была перемещена'
      }
    });
  });
}