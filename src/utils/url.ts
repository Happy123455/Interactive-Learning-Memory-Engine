// Helper function to resolve static and API simulation URLs for both Localhost and GitHub Pages
export const getSimUrl = (path?: string): string => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('blob:') || path.startsWith('data:')) {
    return path;
  }

  const base = import.meta.env.BASE_URL || '/';
  const cleanBase = base.endsWith('/') ? base : base + '/';

  let p = path.trim();

  // If path already starts with cleanBase, prevent double-prefixing
  if (cleanBase !== '/' && p.startsWith(cleanBase)) {
    return p;
  }

  if (p.startsWith('/simulations/')) {
    p = 'data' + p;
  } else if (p.startsWith('simulations/')) {
    p = 'data/' + p;
  } else if (p.startsWith('/data/')) {
    p = p.slice(1);
  } else if (p.startsWith('/')) {
    p = p.slice(1);
  }

  return `${cleanBase}${p}`;
};
