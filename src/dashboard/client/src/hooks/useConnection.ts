import { useEffect, useState } from 'react';
import { useStatusQuery } from './queries/useStatusQuery';

export function useConnection() {
  const [online, setOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [reconnecting, setReconnecting] = useState(false);

  const statusQuery = useStatusQuery();
  const isSuccess = statusQuery.isSuccess && statusQuery.data !== null;

  useEffect(() => {
    const onOnline = () => {
      setOnline(true);
      setReconnecting(false);
    };
    const onOffline = () => {
      setOnline(false);
      setReconnecting(true);
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    if (online) {return undefined;}
    setReconnecting(true);
    const interval = setInterval(() => {
      statusQuery.refetch().then((result) => {
        if (result?.data) {
          setOnline(true);
          setReconnecting(false);
        }
      });
    }, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch when offline only; statusQuery ref intentionally omitted
  }, [online]);

  useEffect(() => {
    if (online && isSuccess) {
      setReconnecting(false);
    }
  }, [online, isSuccess]);

  return { online, reconnecting };
}
