import { Router } from 'express';
import { ensureAuthenticatedAndAuthorized } from '../../middleware/auth.middleware';
import { validateFormBinding } from '../../middleware/validation.middleware';
import { FormsController } from '../../controllers/forms.controller';

const router = Router();

router.get('/', ensureAuthenticatedAndAuthorized, FormsController.getAll);
router.post('/', ensureAuthenticatedAndAuthorized, validateFormBinding, FormsController.create);
router.put('/:formId', ensureAuthenticatedAndAuthorized, validateFormBinding, FormsController.update);
router.delete('/:formId', ensureAuthenticatedAndAuthorized, FormsController.delete);

export default router;