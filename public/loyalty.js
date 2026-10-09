(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PINOY_LOYALTY = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function count(value) {
    return Math.max(0, Math.floor(Number(value) || 0));
  }

  function rewardKind(threshold) {
    const value = Math.trunc(Number(threshold) || 0);
    return value > 0 ? value % 10 || 10 : 0;
  }

  function cycleBase(completedOrders) {
    const total = count(completedOrders);
    return total > 0 ? Math.floor((total - 1) / 10) * 10 : 0;
  }

  function cycleProgress(completedOrders) {
    const total = count(completedOrders);
    return total % 10 || (total ? 10 : 0);
  }

  function availableRewards(completedOrders, redeemedThresholds) {
    const total = count(completedOrders);
    const base = cycleBase(total);
    const redeemed = new Set(Array.from(redeemedThresholds || [], value =>
      Number(value && typeof value === "object" ? value.threshold : value)
    ));
    return [
      { threshold: base + 5, label: "20% off your order" },
      { threshold: base + 8, label: "Free delivery" },
      { threshold: base + 10, label: "One free meal" }
    ].filter(reward => total >= reward.threshold && !redeemed.has(reward.threshold));
  }

  function calculateRewardDiscount(threshold, subtotal, eligibleMealPrices) {
    const total = Math.max(0, Number(subtotal) || 0);
    const kind = rewardKind(threshold);
    if (kind === 5) return total * 0.2;
    if (kind === 10) {
      const prices = (Array.isArray(eligibleMealPrices) ? eligibleMealPrices : [])
        .map(Number)
        .filter(price => Number.isFinite(price) && price > 0);
      return prices.length ? Math.min(...prices) : 0;
    }
    return 0;
  }

  function deliveryFee(fee, threshold) {
    return rewardKind(threshold) === 8 ? 0 : Math.max(0, Number(fee) || 0);
  }

  return { rewardKind, cycleBase, cycleProgress, availableRewards, calculateRewardDiscount, deliveryFee };
});
