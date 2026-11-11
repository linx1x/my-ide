/** Read-only unified diff with the same styling as the Git panel. */
interface GitDiffViewerProps {
  diff?: string | null;
}

export function GitDiffViewer({ diff }: GitDiffViewerProps) {
  if (!diff) {
    return <div className="git-diff-empty">No diff available</div>;
  }
  const lines = diff.split('\n');
  return (
    <pre className="git-diff-content git-diff-content--editor">
      {lines.map((line, i) => {
        let cls = '';
        if (line.startsWith('+') && !line.startsWith('+++')) {
          cls = 'dl-add';
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          cls = 'dl-del';
        } else if (line.startsWith('@@')) {
          cls = 'dl-hunk';
        } else if (
          line.startsWith('diff ') ||
          line.startsWith('index ') ||
          line.startsWith('commit ') ||
          line.startsWith('Author') ||
          line.startsWith('Date:')
        ) {
          cls = 'dl-meta';
        }
        return (
          <div key={i} className={cls}>
            {line || '\u00a0'}
          </div>
        );
      })}
    </pre>
  );
}
