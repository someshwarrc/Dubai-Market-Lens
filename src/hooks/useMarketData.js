import { useEffect, useState } from 'react';
import { loadMarketData } from '../data/marketData';

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

  return state;
};

