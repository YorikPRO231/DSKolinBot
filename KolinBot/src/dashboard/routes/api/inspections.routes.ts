import { Router } from 'express';
import { ensureAuthenticatedAndAuthorized } from '../../middleware/auth.middleware';
import { validateInspectionReport } from '../../middleware/validation.middleware';
import { InspectionsController } from '../../controllers/inspections.controller';

const router = Router();

router.get('/passport/:passport', ensureAuthenticatedAndAuthorized, InspectionsController.getByPassport);
router.get('/discord/:discordId', ensureAuthenticatedAndAuthorized, InspectionsController.getByDiscord);
router.get('/admin/:adminId', ensureAuthenticatedAndAuthorized, InspectionsController.getByAdmin);
router.get('/recent', ensureAuthenticatedAndAuthorized, InspectionsController.getRecent);
router.post('/', ensureAuthenticatedAndAuthorized, validateInspectionReport, InspectionsController.create);
router.put('/update/:id', ensureAuthenticatedAndAuthorized, InspectionsController.update);

export default router;