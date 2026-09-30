import { useCallback, useEffect, useState } from 'react';
import { loadMarketData } from '../data/marketData';
import { reviewApiTransaction, updateCachedTransactionReview } from '../data/marketApi';

export const useMarketData = () => {
  const [state, setState] = useState({ data: null, loading: true, error: null });

  useEffect(() => {
    let active = true;
    loadMarketData()
      .then((data) => active && setState({ data, loading: false, error: null }))
      .catch((error) => active && setState({ data: null, loading: false, error }));

    return () => {
      active = false;
    };
  }, []);

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
