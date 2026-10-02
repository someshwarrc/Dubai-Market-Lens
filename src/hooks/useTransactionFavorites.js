import { useCallback, useEffect, useState } from 'react';
import { favoriteApiTransaction, loadApiTransactionFavorites } from '../data/marketApi';

export const useTransactionFavorites = (accessToken) => {
  const [state, setState] = useState({ transactionNumbers: new Set(), canReview: false, loading: false, error: null });
  const [pendingTransactionNumber, setPendingTransactionNumber] = useState('');

  useEffect(() => {
    let active = true;
    if (!accessToken) {
      setState({ transactionNumbers: new Set(), canReview: false, loading: false, error: null });
      return () => { active = false; };
    }

    setState((current) => ({ ...current, loading: true, error: null }));
    loadApiTransactionFavorites(accessToken)
      .then((result) => {
        if (!active) return;
        setState({
          transactionNumbers: new Set(Array.isArray(result.items) ? result.items : []),
          canReview: result.canReview === true,
          loading: false,
          error: null,
        });
      })
      .catch((error) => {
        if (active) setState({ transactionNumbers: new Set(), canReview: false, loading: false, error });
      });

    return () => { active = false; };
  }, [accessToken]);

  const setFavorite = useCallback(async (transactionNumber, favorite) => {
    setPendingTransactionNumber(transactionNumber);
    try {
      const result = await favoriteApiTransaction({ transactionNumber, favorite, accessToken });
      setState((current) => {
        const transactionNumbers = new Set(current.transactionNumbers);
        if (result.favorite) transactionNumbers.add(transactionNumber);
        else transactionNumbers.delete(transactionNumber);
        return { ...current, transactionNumbers, error: null };
      });
      return result;
    } finally {
      setPendingTransactionNumber('');
    }
  }, [accessToken]);

  return { ...state, pendingTransactionNumber, setFavorite };
};
