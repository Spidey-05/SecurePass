import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import * as vaultController from '../controllers/vault.controller';
import * as historyController from '../controllers/history.controller';
import { authenticate, validateRequest } from '../middleware/auth.middleware';
import { authRateLimit, strictRateLimit } from '../middleware/security.middleware';
import {
  registerSchema,
  loginSchema,
  sendHintSchema,
  createVaultItemSchema,
  updateVaultItemSchema,
  deleteVaultItemSchema,
  duplicateCheckSchema,
  createHistorySchema,
  historyQuerySchema,
  vaultQuerySchema,
} from '../validators/schemas';

// ─── Auth Routes ───────────────────────────────────────────────────────────────

const authRouter = Router();

authRouter.post(
  '/send-hint',
  authRateLimit,
  validateRequest(sendHintSchema),
  authController.sendHint
);

authRouter.post(
  '/register',
  authRateLimit,
  validateRequest(registerSchema),
  authController.register
);

authRouter.post(
  '/login',
  authRateLimit,
  validateRequest(loginSchema),
  authController.login
);

authRouter.post(
  '/refresh',
  strictRateLimit,
  authController.refresh
);

authRouter.post(
  '/logout',
  authController.logout
);

authRouter.post(
  '/logout-all',
  authenticate,
  authController.logoutAll
);

authRouter.get(
  '/me',
  authenticate,
  authController.getMe
);

// ─── Vault Routes ──────────────────────────────────────────────────────────────

const vaultRouter = Router();

vaultRouter.use(authenticate);

vaultRouter.get(
  '/',
  validateRequest(vaultQuerySchema),
  vaultController.getAllItems
);

vaultRouter.post(
  '/',
  validateRequest(createVaultItemSchema),
  vaultController.createItem
);

vaultRouter.get(
  '/:id',
  vaultController.getItem
);

vaultRouter.patch(
  '/:id',
  validateRequest(updateVaultItemSchema),
  vaultController.updateItem
);

vaultRouter.delete(
  '/:id',
  validateRequest(deleteVaultItemSchema),
  vaultController.deleteItem
);

vaultRouter.post(
  '/check-duplicates',
  validateRequest(duplicateCheckSchema),
  vaultController.checkDuplicates
);

// ─── History Routes ────────────────────────────────────────────────────────────

const historyRouter = Router();

historyRouter.use(authenticate);

historyRouter.get(
  '/',
  validateRequest(historyQuerySchema),
  historyController.getHistory
);

historyRouter.post(
  '/',
  validateRequest(createHistorySchema),
  historyController.createEntry
);

historyRouter.delete(
  '/',
  historyController.clearHistory
);

historyRouter.delete(
  '/:id',
  historyController.deleteEntry
);

// ─── Root API Router ───────────────────────────────────────────────────────────

const apiRouter: Router = Router();

apiRouter.get('/health', (_req, res) => {
  res.json({
    success: true,
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'SecurePass API',
  });
});

apiRouter.use('/auth', authRouter);
apiRouter.use('/vault', vaultRouter);
apiRouter.use('/history', historyRouter);

export { apiRouter };
