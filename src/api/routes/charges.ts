import { Router } from 'express';
import { requireScope } from '../middleware/auth';
import { ChargeSchema } from '../validators/chargeValidators';
import { resolveTokenToPan } from '../../services/vaultService';
import { charge, listCharges } from '../../services/processorService';
import { writeAudit } from '../../services/auditService';
import { isValidTokenFormat } from '../../vault/tokenizer';

const router = Router({ mergeParams: true });

// POST /v1/instruments/:token/charges — charge a stored card
router.post('/', requireScope('charge'), async (req, res, next) => {
  const { token } = req.params;

  try {
    if (!isValidTokenFormat(token)) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Invalid token format' });
      return;
    }

    const body = ChargeSchema.parse(req.body);
    const { pan, expiryMonth, expiryYear } = await resolveTokenToPan(req.ctx.merchantId, token);

    const chargeRecord = await charge(
      token,
      req.ctx.merchantId,
      pan,
      expiryMonth,
      expiryYear,
      {
        amount: body.amount,
        currency: body.currency,
        description: body.description,
        idempotencyKey: body.idempotency_key,
      },
    );

    await writeAudit(req.ctx, {
      action: 'CHARGE_INSTRUMENT',
      outcome: 'success',
      token,
      metadata: { chargeId: chargeRecord.chargeId, status: chargeRecord.status },
    });

    res.status(201).json(chargeRecord);
  } catch (err) {
    await writeAudit(req.ctx, {
      action: 'CHARGE_INSTRUMENT',
      outcome: 'failure',
      token,
      errorCode: (err as Error).name,
    }).catch(() => {});
    next(err);
  }
});

// GET /v1/instruments/:token/charges — list all charges for a token
router.get('/', requireScope('read'), async (req, res, next) => {
  const { token } = req.params;

  try {
    if (!isValidTokenFormat(token)) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Invalid token format' });
      return;
    }

    const charges = await listCharges(req.ctx.merchantId, token);

    await writeAudit(req.ctx, {
      action: 'LIST_CHARGES',
      outcome: 'success',
      token,
    });

    res.json({ data: charges, count: charges.length });
  } catch (err) {
    next(err);
  }
});

export default router;
