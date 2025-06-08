import { Router } from 'express';
import { sendContact } from '../controllers/ContactController';

const router = Router();

router.post('/send', sendContact);

export default router; 