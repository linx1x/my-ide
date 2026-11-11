import { useState, useMemo, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api';

type TreeItem = {
  name?: string;
  path?: string;
  isDir?: boolean;
  children?: TreeItem[];
  [key: string]: unknown;
};

function flattenTree(items: TreeItem[], list: TreeItem[] = []): TreeItem[] {
  for (const item of items) {
    list.push(item);
    if (item.isDir && item.children) {flattenTree(item.children, list);}
  }
  return list;
}

async function fetchFileTree(showHidden: boolean): Promise<{ tree: TreeItem[] }> {
  const r = await api('/files/tree' + (showHidden ? '?showHidden=1' : ''));
  const data = await r.json();
  return { tree: data.tree || [] };
}

export function useFileTree() {
  const [showDotfiles, setShowDotfiles] = useState(false);

  const query = useQuery({
    queryKey: ['files', 'tree', showDotfiles],
    queryFn: () => fetchFileTree(showDotfiles),
    staleTime: 10_000,
  });

  const refetchRef = useRef(query.refetch);
  refetchRef.current = query.refetch;

  const tree = useMemo(() => query.data?.tree ?? [], [query.data?.tree]);
  const flatFileList = useMemo(() => flattenTree(tree), [tree]);

  const loadFileTree = useCallback((overrideShowHidden?: boolean) => {
    if (typeof overrideShowHidden === 'boolean') {
      setShowDotfiles(overrideShowHidden);
    } else {
      refetchRef.current();
    }
  }, []);

  const toggleDotfiles = useCallback(() => {
    setShowDotfiles((prev) => !prev);
  }, []);

  return {
    fileTreeData: tree,
    flatFileList,
    showDotfiles,
    loading: query.isPending,
    error: query.error?.message ?? null,
    loadFileTree,
    toggleDotfiles,
  };
}
