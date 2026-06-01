import { Router } from 'express';
import { ensureAuthenticatedAndAuthorized } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/permissions.middleware';
import { FormsController } from '../../controllers/forms.controller';

const router = Router();

router.get('/', 
  ensureAuthenticatedAndAuthorized, 
  requirePermission('manage_forms'), 
  FormsController.getAll
);

router.post('/', 
  ensureAuthenticatedAndAuthorized, 
  requirePermission('manage_forms'), 
  FormsController.create
);

router.put('/:formId', 
  ensureAuthenticatedAndAuthorized, 
  requirePermission('manage_forms'), 
  FormsController.update
);

router.delete('/:formId', 
  ensureAuthenticatedAndAuthorized, 
  requirePermission('manage_forms'), 
  FormsController.delete
);

export default router;