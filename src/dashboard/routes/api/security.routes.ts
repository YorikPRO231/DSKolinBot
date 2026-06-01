import {Router} from 'express';
import {ensureAuthenticatedAndAuthorized} from '../../middleware/auth.middleware';
import {validateSecurityAlert} from '../../middleware/validation.middleware';
import {SecurityController} from '../../controllers/security.controller';

const router = Router();

router.get('/alerts', ensureAuthenticatedAndAuthorized, SecurityController.getAlerts);
router.get('/alerts/history/:static', ensureAuthenticatedAndAuthorized, SecurityController.getAlertHistory);
router.post('/alerts/add', ensureAuthenticatedAndAuthorized, validateSecurityAlert, SecurityController.addAlert);
router.post('/alerts/:id/close', ensureAuthenticatedAndAuthorized, SecurityController.closeAlert);
router.get('/alerts/:id', ensureAuthenticatedAndAuthorized, SecurityController.getAlertById);
router.get('/logs', ensureAuthenticatedAndAuthorized, SecurityController.getLogs);
router.post('/request', ensureAuthenticatedAndAuthorized, SecurityController.addSecurityRequest);


export default router;