import { Router } from 'express';
import { requireScope } from '../middleware/auth';
import { StoreCardSchema } from '../validators/instrumentValidators';
import { storeCard, getInstrument, revokeInstrument } from '../../services/vaultService';
import { writeAudit } from '../../services/auditService';
import { isValidTokenFormat } from '../../vault/tokenizer';

const router = Router();

// POST /v1/instruments — store a new card
router.post('/', requireScope('store'), async (req, res, next) => {
  try {
    const body = StoreCardSchema.parse(req.body);

    const summary = await storeCard(req.ctx.merchantId, {
      pan: body.pan,
      expiryMonth: body.expiry_month,
      expiryYear: body.expiry_year,
      cardholderName: body.cardholder_name,
    });

    await writeAudit(req.ctx, {
      action: 'STORE_INSTRUMENT',
      outcome: 'success',
      token: summary.token,
    });

    res.status(201).json(summary);
  } catch (err) {
    await writeAudit(req.ctx, {
      action: 'STORE_INSTRUMENT',
      outcome: 'failure',
      errorCode: (err as Error).name,
    }).catch(() => {});
    next(err);
  }
});

// GET /v1/instruments/:token — retrieve token metadata (PAN never returned)
router.get('/:token', requireScope('read'), async (req, res, next) => {
  try {
    const { token } = req.params;

    if (!isValidTokenFormat(token)) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Invalid token format' });
      return;
    }

    const summary = await getInstrument(req.ctx.merchantId, token);

    await writeAudit(req.ctx, {
      action: 'RETRIEVE_INSTRUMENT',
      outcome: 'success',
      token,
    });

    res.json(summary);
  } catch (err) {
    next(err);
  }
});

// DELETE /v1/instruments/:token — revoke a stored card
router.delete('/:token', requireScope('revoke'), async (req, res, next) => {
  try {
    const { token } = req.params;

    if (!isValidTokenFormat(token)) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Invalid token format' });
      return;
    }

    await revokeInstrument(req.ctx.merchantId, token);

    await writeAudit(req.ctx, {
      action: 'REVOKE_INSTRUMENT',
      outcome: 'success',
      token,
    });

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
