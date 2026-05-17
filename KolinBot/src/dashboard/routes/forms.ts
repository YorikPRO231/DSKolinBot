import { Router } from 'express';
import { ensureAuthenticated, ensureAdmin } from '../middleware/auth';
import { bindingsManager } from '../../utils/bindingsManager';

const router = Router();

router.get('/', ensureAuthenticated, (req, res) => {
  try {
    const bindings = bindingsManager.getAllBindings();
    res.json({ success: true, bindings });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Ошибка получения данных' });
  }
});

router.post('/', ensureAdmin, (req, res) => {
  try {
    const { formId, channelId, guildId, formName, pingRoleId, pingRoleId2 } = req.body;
    
    if (!formId || !channelId || !guildId) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const binding = bindingsManager.addBinding(
      formId, channelId, guildId, formName, pingRoleId, pingRoleId2
    );
    
    res.json({ success: true, binding });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Ошибка добавления формы' });
  }
});

router.put('/:formId', ensureAdmin, (req, res) => {
  try {
    const formId = req.params.formId as string;
    const { channelId, guildId, formName, pingRoleId, pingRoleId2 } = req.body;
    
    bindingsManager.removeBinding(formId);
    const binding = bindingsManager.addBinding(
      formId, channelId, guildId, formName, pingRoleId, pingRoleId2
    );
    
    res.json({ success: true, binding });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Ошибка обновления' });
  }
});

router.delete('/:formId', ensureAdmin, (req, res) => {
  try {
    const formId = req.params.formId as string;
    const deleted = bindingsManager.removeBinding(formId);
    if (deleted) {
      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, error: 'Привязка не найдена' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: 'Ошибка удаления' });
  }
});

export default router;