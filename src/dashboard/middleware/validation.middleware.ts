import { Request, Response, NextFunction } from 'express';

interface ValidationRule {
  field: string;
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'array' | 'object';
  min?: number;
  max?: number;
  pattern?: RegExp;
  custom?: (value: any) => boolean;
  message?: string;
}

export function validate(rules: ValidationRule[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: string[] = [];
    
    for (const rule of rules) {
      const value = req.body[rule.field];
      
      if (rule.required && (value === undefined || value === null || value === '')) {
        errors.push(rule.message || `Поле ${rule.field} обязательно`);
        continue;
      }
      
      if (!rule.required && (value === undefined || value === null || value === '')) {
        continue;
      }
      
      if (rule.type) {
        if (rule.type === 'string' && typeof value !== 'string') {
          errors.push(`Поле ${rule.field} должно быть строкой`);
        } else if (rule.type === 'number' && typeof value !== 'number' && isNaN(Number(value))) {
          errors.push(`Поле ${rule.field} должно быть числом`);
        } else if (rule.type === 'boolean' && typeof value !== 'boolean') {
          errors.push(`Поле ${rule.field} должно быть булевым`);
        } else if (rule.type === 'array' && !Array.isArray(value)) {
          errors.push(`Поле ${rule.field} должно быть массивом`);
        } else if (rule.type === 'object' && (typeof value !== 'object' || value === null)) {
          errors.push(`Поле ${rule.field} должно быть объектом`);
        }
      }
      
      if (rule.type === 'string') {
        if (rule.min !== undefined && value.length < rule.min) {
          errors.push(`Поле ${rule.field} должно содержать минимум ${rule.min} символов`);
        }
        if (rule.max !== undefined && value.length > rule.max) {
          errors.push(`Поле ${rule.field} должно содержать максимум ${rule.max} символов`);
        }
      }
      
      if (rule.type === 'number') {
        const numValue = Number(value);
        if (rule.min !== undefined && numValue < rule.min) {
          errors.push(`Поле ${rule.field} должно быть не меньше ${rule.min}`);
        }
        if (rule.max !== undefined && numValue > rule.max) {
          errors.push(`Поле ${rule.field} должно быть не больше ${rule.max}`);
        }
      }
      
      if (rule.pattern && !rule.pattern.test(String(value))) {
        errors.push(rule.message || `Поле ${rule.field} имеет неверный формат`);
      }
      
      if (rule.custom && !rule.custom(value)) {
        errors.push(rule.message || `Поле ${rule.field} не прошло проверку`);
      }
    }
    
    if (errors.length > 0) {
      const isApiRequest = req.path.startsWith('/api/') || req.xhr;
      
      if (isApiRequest) {
        return res.status(400).json({ 
          success: false, 
          error: 'Validation failed',
          details: errors 
        });
      }
      
      return res.status(400).render('error', {
        user: req.user || null,
        title: 'Validation Error',
        error: { code: 400, message: errors.join(', ') }
      });
    }
    
    next();
  };
}

export const validateFormBinding = validate([
  { field: 'formId', required: true, type: 'string', min: 1, max: 100 },
  { field: 'channelId', required: true, type: 'string', pattern: /^\d{17,20}$/, message: 'Некорректный ID канала' },
  { field: 'guildId', required: true, type: 'string', pattern: /^\d{17,20}$/, message: 'Некорректный ID сервера' },
  { field: 'formName', required: false, type: 'string', max: 200 },
  { field: 'pingRoleId', required: false, type: 'string', pattern: /^\d{17,20}$/, message: 'Некорректный ID роли' },
  { field: 'pingRoleId2', required: false, type: 'string', pattern: /^\d{17,20}$/, message: 'Некорректный ID роли' },
]);

export const validateSecurityAlert = validate([
  { field: 'suspect', required: true, type: 'string', pattern: /^\d+$/, message: 'Паспорт должен содержать только цифры' },
  { field: 'action', required: true, type: 'string', min: 1, max: 500 },
  { field: 'data', required: false, type: 'string', max: 5000 },
]);

export const validateInspectionReport = validate([
  { field: 'passport', required: true, type: 'string', pattern: /^\d+$/, message: 'Некорректный паспорт' },
  { field: 'result', required: true, type: 'string', min: 1, max: 10000 },
  { field: 'discordId', required: false, type: 'string', pattern: /^\d{17,20}$/, message: 'Некорректный Discord ID' },
]);