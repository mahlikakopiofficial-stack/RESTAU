const TABLES = Object.freeze({
  item: 'items',
  regional: 'regional_dishes'
});
const TABLE_VALUES = new Set(Object.values(TABLES));

function quantity(value, fallback = 3) {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 0 || n > 100000) {
    throw new Error('Inventory quantity must be a whole number from 0 to 100000.');
  }
  return n;
}

function refreshDailyInventory(db, table, today) {
  if (!TABLE_VALUES.has(table)) throw new Error('Invalid inventory table.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(today || ''))) throw new Error('Invalid inventory date.');
  db.prepare(
    `UPDATE ${table}
       SET stock_available=COALESCE(daily_restock_quantity,3), stock_date=?
     WHERE COALESCE(stock_date,'')<>?`
  ).run(today, today);
}

function refreshAllDailyInventory(db, today) {
  refreshDailyInventory(db, TABLES.item, today);
  refreshDailyInventory(db, TABLES.regional, today);
}

function inventoryTarget(rawId) {
  const raw = String(rawId ?? '');
  const regional = raw.startsWith('r:');
  const id = Number(regional ? raw.slice(2) : raw);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Invalid dish in cart.');
  return { table: regional ? TABLES.regional : TABLES.item, id };
}

function aggregateLines(items) {
  const totals = new Map();
  for (const item of items || []) {
    const target = inventoryTarget(item.id);
    const qty = quantity(item.qty, 1);
    if (qty < 1) throw new Error('Order quantity must be at least one.');
    const key = target.table + ':' + target.id;
    const current = totals.get(key);
    totals.set(key, {
      ...target,
      qty: (current?.qty || 0) + qty,
      name: current?.name || String(item.name || 'This dish')
    });
  }
  return [...totals.values()];
}

function reserveOrderInventory(db, items, today) {
  refreshAllDailyInventory(db, today);
  const totals = aggregateLines(items);
  for (const line of totals) {
    const result = db.prepare(
      `UPDATE ${line.table}
          SET stock_available=stock_available-?
        WHERE id=? AND active=1 AND stock_date=? AND stock_available>=?`
    ).run(line.qty, line.id, today, line.qty);
    if (result.changes) continue;

    const current = db.prepare(
      `SELECT name,stock_available FROM ${line.table} WHERE id=? AND active=1`
    ).get(line.id);
    if (!current) throw new Error((line.name || 'This dish') + ' is no longer available.');
    const available = Math.max(0, Number(current.stock_available) || 0);
    if (!available) throw new Error((current.name || line.name) + ' is sold out.');
    throw new Error(
      'Not enough stock remains for ' + (current.name || line.name) + '. Reduce the quantity and try again.'
    );
  }
  return true;
}

function restoreCancelledOrderInventory(db, order, today, createdDay) {
  if (!order || Number(order.inventory_deducted) !== 1 || Number(order.inventory_restored) === 1) {
    return false;
  }
  const marked = db.prepare(
    'UPDATE orders SET inventory_restored=1 WHERE id=? AND inventory_deducted=1 AND COALESCE(inventory_restored,0)<>1'
  ).run(order.id);
  if (!marked.changes) return false;

  // A previous day's order must not add old portions to today's replenished stock.
  if (createdDay !== today) return false;
  refreshAllDailyInventory(db, today);

  let items;
  try {
    items = JSON.parse(order.items || '[]');
  } catch {
    throw new Error('Cannot restore inventory for an invalid order record.');
  }
  for (const line of aggregateLines(items)) {
    db.prepare(
      `UPDATE ${line.table}
          SET stock_available=stock_available+?
        WHERE id=? AND stock_date=?`
    ).run(line.qty, line.id, today);
  }
  return true;
}

module.exports = {
  quantity,
  refreshDailyInventory,
  refreshAllDailyInventory,
  reserveOrderInventory,
  restoreCancelledOrderInventory
};
