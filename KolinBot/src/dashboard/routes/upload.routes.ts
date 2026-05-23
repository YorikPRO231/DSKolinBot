import { Router, Request, Response } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { ensureAuthenticatedAndAuthorized } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permissions.middleware';
import { parseLogFile } from '../services/upload.service';
import { PermissionsRepository } from '../../databases';

const router = Router();
const upload = multer({ dest: 'uploads/' });

async function getUserPermissions(req: any): Promise<string[]> {
  const userId = req.user?.id;
  if (!userId) return [];
  return PermissionsRepository.getUserPermissions(userId);
}

router.get('/', 
  ensureAuthenticatedAndAuthorized, 
  requirePermission('view_logs_systeminformer'),
  async (req: Request, res: Response) => {
    const permissions = await getUserPermissions(req);
    res.render('upload', {
      user: req.user,
      currentPage: 'upload',
      title: 'Выгрузка System Informer',
      permissions: permissions,
      results: null,
      error: null
    });
  }
);

router.post('/upload', 
  ensureAuthenticatedAndAuthorized, 
  requirePermission('view_logs_systeminformer'),
  upload.single('logFile'),
  async (req: Request, res: Response) => {
    const permissions = await getUserPermissions(req);
    
    try {
      if (!req.file) {
        return res.status(400).render('upload', {
          user: req.user,
          currentPage: 'upload',
          title: 'Выгрузка System Informer',
          permissions: permissions,
          results: null,
          error: 'Файл не загружен'
        });
      }

      const filePath = req.file.path;
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      
      const results = await parseLogFile(fileContent, req.file.originalname);
      
      fs.unlinkSync(filePath);
      
      res.render('upload', {
        user: req.user,
        currentPage: 'upload',
        title: 'Выгрузка System Informer',
        permissions: permissions,
        results: results,
        error: null
      });
    } catch (error) {
      console.error('Ошибка при обработке файла:', error);
      res.render('upload', {
        user: req.user,
        currentPage: 'upload',
        title: 'Выгрузка System Informer',
        permissions: permissions,
        results: null,
        error: 'Ошибка при обработке файла'
      });
    }
  }
);

export default router;