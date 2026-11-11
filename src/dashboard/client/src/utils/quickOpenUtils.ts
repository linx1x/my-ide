type QuickOpenFile = {
  path: string;
  name: string;
};

export function fuzzyMatch(query: string, text: string): boolean {
  let qi = 0;
  for (let ti = 0; ti < text.length && qi < query.length; ti++) {
    if (text[ti] === query[qi]) {qi++;}
  }
  return qi === query.length;
}

export function scoreFile(query: string, file: QuickOpenFile): number {
  if (!query) {return 0;}
  const lower = query.toLowerCase();
  const pathLower = file.path.toLowerCase();
  const nameLower = file.name.toLowerCase();
  if (nameLower === lower) {return 100;}
  if (nameLower.startsWith(lower)) {return 80;}
  if (nameLower.includes(lower)) {return 60;}
  if (pathLower.includes(lower)) {return 40;}
  if (fuzzyMatch(lower, pathLower)) {return 20;}
  return 0;
}
