import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';

admin.initializeApp();
const db = admin.firestore();

const ALLOWED_ROLES = ['owner', 'admin', 'salesman', 'production_supervisor', 'accountant'] as const;

/**
 * Assign role custom claim to a Firebase Auth user and mirror to users/{uid}.
 * Only callable by an existing owner or admin.
 */
export const setUserRole = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
  }

  const callerRole = request.auth.token.role;
  if (callerRole !== 'owner' && callerRole !== 'admin') {
    throw new HttpsError('permission-denied', 'Only owner or admin can assign roles.');
  }

  const { targetUid, role } = request.data as { targetUid: string; role: string };
  if (!targetUid || !ALLOWED_ROLES.includes(role as any)) {
    throw new HttpsError('invalid-argument', 'Valid targetUid and role are required.');
  }

  await admin.auth().setCustomUserClaims(targetUid, { role });
  await db.collection('users').doc(targetUid).set(
    { role, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
    { merge: true }
  );

  return { success: true, targetUid, role };
});

/**
 * Automatically write an audit log entry whenever a GST invoice is posted.
 */
export const onInvoiceCreated = onDocumentCreated('invoices/{invoiceId}', async (event) => {
  const snap = event.data;
  if (!snap) return;

  const invoice = snap.data();
  await db.collection('auditLogs').add({
    action: 'INVOICE_POSTED',
    entityType: 'invoice',
    entityId: event.params.invoiceId,
    userId: invoice.createdBy || 'system',
    userName: invoice.createdBy || 'System',
    metadata: {
      invoiceNumber: invoice.invoiceNumber,
      customerId: invoice.customerId,
      grandTotalPaise: invoice.grandTotalPaise,
    },
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });
});

/**
 * Reconcile inventoryBalances from the immutable stockLedger source of truth.
 */
export const reconcileStockLedger = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
  }

  const callerRole = request.auth.token.role;
  if (callerRole !== 'owner' && callerRole !== 'admin' && callerRole !== 'accountant') {
    throw new HttpsError('permission-denied', 'Insufficient permissions to reconcile stock.');
  }

  const ledgerSnap = await db.collection('stockLedger').get();
  const totals: Record<string, number> = {};

  ledgerSnap.forEach((docSnap) => {
    const entry = docSnap.data();
    const id = entry.itemId as string;
    const qtyIn = Number(entry.quantityIn || 0);
    const qtyOut = Number(entry.quantityOut || 0);
    totals[id] = (totals[id] || 0) + qtyIn - qtyOut;
  });

  const balancesSnap = await db.collection('inventoryBalances').get();
  const mismatches: { itemId: string; balanceDoc: number; ledgerSum: number }[] = [];

  balancesSnap.forEach((docSnap) => {
    const bal = docSnap.data();
    const ledgerSum = totals[docSnap.id] || 0;
    if (bal.currentStock !== ledgerSum) {
      mismatches.push({
        itemId: docSnap.id,
        balanceDoc: bal.currentStock,
        ledgerSum,
      });
    }
  });

  return {
    reconciled: mismatches.length === 0,
    checkedItems: balancesSnap.size,
    mismatches,
  };
});

