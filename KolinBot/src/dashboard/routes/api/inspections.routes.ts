import { Router } from 'express';
import { ensureAuthenticatedAndAuthorized } from '../../middleware/auth.middleware';
import { validateInspectionReport } from '../../middleware/validation.middleware';
import { InspectionsController } from '../../controllers/inspections.controller';

const router = Router();

router.get('/search', ensureAuthenticatedAndAuthorized, InspectionsController.search);
router.post('/', ensureAuthenticatedAndAuthorized, validateInspectionReport, InspectionsController.create);
router.put('/update/:id', ensureAuthenticatedAndAuthorized, InspectionsController.update);

export default router;