import { useState, useEffect } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import * as ContextMenu from '@radix-ui/react-context-menu';
import { AppCaretMotion } from './AppCaret';
import { getFileLucideIcon, getFolderLucideIcon } from '../utils/fileIconsLucide';

type TreeItem = {
  name: string;
  path: string;
  isDir?: boolean;
  children?: TreeItem[];
};
type TreeMenuEntry = {
  label: string;
  icon?: string;
  action: () => void;
  danger?: boolean;
  disabled?: boolean;
} | null;
type TreeNodeProps = {
  item: TreeItem;
  depth: number;
  expandRoot: boolean;
  onOpenFile: ((path: string) => void) | undefined;
  onContextMenu: ((e: ReactMouseEvent, item: TreeItem) => void) | undefined;
  selectedPath: string | null | undefined;
  onSelect: ((path: string, item: TreeItem) => void) | undefined;
  buildContextMenuItems: ((item: TreeItem) => TreeMenuEntry[]) | undefined;
  reducedMotion: boolean;
};
type FileTreeProps = {
  items: TreeItem[];
  onOpenFile: ((path: string) => void) | undefined;
  onContextMenu: ((e: ReactMouseEvent, item: TreeItem) => void) | undefined;
  selectedPath: string | null | undefined;
  onSelect: ((path: string, item: TreeItem) => void) | undefined;
  buildContextMenuItems: ((item: TreeItem) => TreeMenuEntry[]) | undefined;
};

const motionTransition: any = { type: 'tween', duration: 0.15 };
const folderIconTransition: any = { type: 'tween', duration: 0.18, ease: [0.25, 0.1, 0.25, 1] };
const childrenContainerTransition: any = { type: 'tween', duration: 0.2, ease: [0.25, 0.1, 0.25, 1] };
const childStaggerDelay = 0.022;
const childStaggerDuration = 0.14;

function useReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const fn = () => setReduced(mq.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);
  return reduced;
}

function TreeNode({
  item,
  depth,
  expandRoot,
  onOpenFile,
  onContextMenu,
  selectedPath,
  onSelect,
  buildContextMenuItems,
  reducedMotion,
}: TreeNodeProps) {
  const hasChildren = !!(item.isDir && item.children?.length);
  const [expanded, setExpanded] = useState(expandRoot && depth === 0 && !!item.isDir);
  const isOpen = expanded && hasChildren;
  const noMotion = reducedMotion === true;

  const handleChevronClick = (e: ReactMouseEvent) => {
    e.stopPropagation();
    if (item.isDir && hasChildren) {setExpanded(!expanded);}
  };

  const handleClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement | null)?.closest?.('.tree-toggle')) {return;}
    onSelect?.(item.path, item);
    if (item.isDir) {
      if (hasChildren) {setExpanded(!expanded);}
    } else {
      onOpenFile?.(item.path);
    }
  };

  const handleContextMenu = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (!buildContextMenuItems) {
      e.preventDefault();
      onContextMenu?.(e, item);
    }
  };

  const iconInfo = item.isDir
    ? getFolderLucideIcon(item.name, isOpen)
    : getFileLucideIcon(item.name, false);
  const { Icon, color } = iconInfo;

  const isSelected = selectedPath === item.path;

  const folderIconEl = item.isDir ? (
    <motion.span
      className="tree-file-icon tree-folder-icon"
      style={{ color }}
      whileHover={{ scale: 1.1 }}
      transition={motionTransition}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={isOpen ? 'open' : 'closed'}
          initial={(noMotion ? undefined : { opacity: 0, scale: 0.92 }) as any}
          animate={{ opacity: 1, scale: 1 }}
          exit={(noMotion ? undefined : { opacity: 0, scale: 0.92 }) as any}
          transition={noMotion ? { duration: 0 } : folderIconTransition}
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon size={16} strokeWidth={2} />
        </motion.span>
      </AnimatePresence>
    </motion.span>
  ) : (
    <motion.span
      className="tree-file-icon"
      style={{ color }}
      whileHover={{ scale: 1.1 }}
      transition={motionTransition}
    >
      <Icon size={16} strokeWidth={2} />
    </motion.span>
  );

  const row = (
    <div
      className={`tree-item ${item.isDir ? 'folder' : 'file'} ${isSelected ? 'selected' : ''}`}
      style={{ paddingLeft: depth * 16 + (isSelected ? 6 : 8) }}
      onClick={handleClick}
      onContextMenu={buildContextMenuItems ? undefined : handleContextMenu}
    >
      {item.isDir ? (
        <AppCaretMotion
          className={'tree-chevron tree-toggle'}
          isOpen={isOpen}
          closedDirection="right"
          openDirection="down"
          onClick={handleChevronClick}
        />
      ) : (
        <span className="tree-chevron" aria-hidden />
      )}
      {folderIconEl}
      <span className="tree-label" style={!item.isDir ? { color } : undefined} title={item.path}>
        {item.name}
      </span>
    </div>
  );

  const menuItems = buildContextMenuItems ? buildContextMenuItems(item) : [];

  const content = buildContextMenuItems && menuItems.length > 0 ? (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>{row}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content {...({ className: 'explorer-ctx-menu git-ctx-menu', sideOffset: 2 } as any)}>
          {menuItems.map((entry: TreeMenuEntry, i: number) =>
            entry === null ? (
              <ContextMenu.Separator key={i} className="git-ctx-sep" />
            ) : (
              <ContextMenu.Item
                key={i}
                className={`git-ctx-item${entry.danger ? ' danger' : ''}${entry.disabled ? ' disabled' : ''}`}
                onSelect={() => {
                  if (!entry.disabled) {entry.action();}
                }}
              >
                {entry.icon != null && entry.icon !== '' && (
                  <span className="git-ctx-icon">{entry.icon}</span>
                )}
                {entry.label}
              </ContextMenu.Item>
            )
          )}
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  ) : (
    row
  );

  return (
    <>
      {content}
      <AnimatePresence initial={false}>
        {hasChildren && isOpen && (
          <motion.div
            key="children"
            className="tree-children"
            initial={(noMotion ? undefined : { opacity: 0, y: -3 }) as any}
            animate={{ opacity: 1, y: 0 }}
            exit={(noMotion ? undefined : { opacity: 0, y: -2 }) as any}
            transition={noMotion ? { duration: 0 } : childrenContainerTransition}
          >
            {(item.children ?? []).map((child, index) => (
              <motion.div
                key={child.path}
                initial={(noMotion ? undefined : { opacity: 0, x: -6 }) as any}
                animate={{ opacity: 1, x: 0 }}
                transition={
                  noMotion
                    ? { duration: 0 }
                    : {
                      delay: index * childStaggerDelay,
                      duration: childStaggerDuration,
                      ease: [0.25, 0.1, 0.25, 1],
                    }
                }
              >
                <TreeNode
                  item={child}
                  depth={depth + 1}
                  expandRoot={false}
                  onOpenFile={onOpenFile}
                  onContextMenu={onContextMenu}
                  selectedPath={selectedPath}
                  onSelect={onSelect}
                  buildContextMenuItems={buildContextMenuItems}
                  reducedMotion={reducedMotion}
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export function FileTree({
  items,
  onOpenFile,
  onContextMenu,
  selectedPath,
  onSelect,
  buildContextMenuItems,
}: FileTreeProps) {
  const reducedMotion = useReducedMotion();

  if (!items?.length) {
    return (
      <span className="muted" style={{ padding: '8px 12px', display: 'block', fontSize: 12 }}>
        Empty
      </span>
    );
  }

  return (
    <div className="file-tree-wrap">
      {items.map((item) => (
        <TreeNode
          key={item.path}
          item={item}
          depth={0}
          expandRoot={true}
          onOpenFile={onOpenFile}
          onContextMenu={onContextMenu}
          selectedPath={selectedPath}
          onSelect={onSelect}
          buildContextMenuItems={buildContextMenuItems}
          reducedMotion={reducedMotion}
        />
      ))}
    </div>
  );
}
