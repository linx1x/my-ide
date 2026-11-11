import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';

type DbResult = { columns: unknown[]; rows: unknown[] };
type DbConfig = { type: string; [key: string]: unknown };

async function fetchTables(connectionId: string): Promise<string[]> {
  const r = await api(`/db/tables?connectionId=${encodeURIComponent(connectionId)}`);
  const data = await r.json();
  if (!r.ok) {throw new Error(data.error || 'Failed to load tables');}
  return data.tables ?? [];
}

async function fetchSchema({ connectionId, table }: { connectionId: string; table: string }): Promise<unknown[]> {
  const r = await api(
    `/db/schema?connectionId=${encodeURIComponent(connectionId)}&table=${encodeURIComponent(table)}`
  );
  const data = await r.json();
  if (!r.ok) {throw new Error(data.error || 'Failed to load schema');}
  return data.columns ?? [];
}

export function useDatabase(activePanel: string) {
  const queryClient = useQueryClient();
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [connectionType, setConnectionType] = useState<string | null>(null);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);

  const connect = useCallback(async (config: DbConfig) => {
    const r = await api('/db/connect', { method: 'POST', body: config });
    const data = await r.json();
    if (!r.ok) {throw new Error(data.error || 'Connection failed');}
    setConnectionId(data.connectionId);
    setConnectionType(config.type);
    setSelectedTable(null);
    return data.connectionId;
  }, []);

  const disconnect = useCallback(async () => {
    if (!connectionId) {return;}
    try {
      await api('/db/disconnect', { method: 'POST', body: { connectionId } });
    } catch {}
    setConnectionId(null);
    setConnectionType(null);
    setSelectedTable(null);
  }, [connectionId]);

  const tablesQuery = useQuery({
    queryKey: ['db', 'tables', connectionId],
    queryFn: () => fetchTables(connectionId as string),
    enabled: !!connectionId && activePanel === 'database',
  });

  const schemaQuery = useQuery({
    queryKey: ['db', 'schema', connectionId, selectedTable],
    queryFn: () => fetchSchema({ connectionId: connectionId as string, table: selectedTable as string }),
    enabled: !!connectionId && !!selectedTable,
  });

  const runQueryMutation = useMutation({
    mutationFn: async ({ connectionId, sql, params }: { connectionId: string; sql: string; params: unknown[] }): Promise<DbResult> => {
      const r = await api('/db/query', { method: 'POST', body: { connectionId, sql, params } });
      const data = await r.json();
      if (!r.ok) {throw new Error(data.error || 'Query failed');}
      return { columns: data.columns || [], rows: data.rows || [] };
    },
  });

  const refreshTables = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['db', 'tables', connectionId] });
  }, [queryClient, connectionId]);

  const loadSchema = useCallback((table: string) => {
    setSelectedTable(table);
  }, []);

  const runQuery = useCallback(
    async (sql: string, params: unknown[] = []) => {
      if (!connectionId) {return;}
      return runQueryMutation.mutateAsync({ connectionId, sql, params });
    },
    [connectionId, runQueryMutation]
  );

  const tables = tablesQuery.data ?? [];
  const schema = schemaQuery.data ?? [];
  const queryResult = runQueryMutation.data ?? null;
  const loading =
    tablesQuery.isPending ||
    schemaQuery.isPending ||
    runQueryMutation.isPending;
  const error =
    tablesQuery.error?.message ??
    schemaQuery.error?.message ??
    runQueryMutation.error?.message ??
    null;

  return {
    connectionId,
    connectionType,
    tables,
    schema,
    selectedTable,
    queryResult,
    loading,
    error,
    connect,
    disconnect,
    refreshTables,
    loadSchema,
    runQuery,
  };
}
