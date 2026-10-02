import { useCallback, useEffect, useState } from 'react';
import { loadMarketData } from '../data/marketData';
import { reviewApiTransaction, updateCachedTransactionReview } from '../data/marketApi';

export const useMarketData = ({ from, to }) => {
  const [state, setState] = useState({ data: null, loading: true, refreshing: false, error: null });

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setState((current) => ({ ...current, loading: !current.data, refreshing: Boolean(current.data), error: null }));
    loadMarketData({ from, to, signal: controller.signal })
      .then((data) => active && setState({ data, loading: false, refreshing: false, error: null }))
      .catch((error) => {
        if (!active || error?.name === 'AbortError') return;
        setState((current) => ({ ...current, loading: false, refreshing: false, error }));
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [from, to]);

  const reviewTransaction = useCallback(async ({ transactionNumber, decision, accessToken, restoreRows = [] }) => {
    const removedRows = decision === 'disliked'
      ? state.data?.transactions.filter((row) => row.transactionNumber === transactionNumber) ?? []
      : [];
    const result = await reviewApiTransaction({ transactionNumber, decision, accessToken });
    setState((current) => {
      if (!current.data) return current;
      let transactions;
      if (decision === 'disliked') {
        transactions = current.data.transactions.filter((row) => row.transactionNumber !== transactionNumber);
      } else if (restoreRows.length) {
        transactions = [
          ...current.data.transactions.filter((row) => row.transactionNumber !== transactionNumber),
          ...restoreRows.map((row) => ({ ...row, reviewDecision: decision === 'liked' ? 'liked' : null })),
        ];
      } else {
        transactions = current.data.transactions.map((row) => row.transactionNumber === transactionNumber
          ? { ...row, reviewDecision: decision === 'liked' ? 'liked' : null }
          : row);
      }
      return { ...current, data: { ...current.data, transactions } };
    });
    await updateCachedTransactionReview({ transactionNumber, decision, restoreRows }).catch(() => {});
    return { ...result, removedRows };
  }, [state.data]);

  return { ...state, reviewTransaction };
};
