export const dashboardPath = (user) =>
  user.role === 'admin' ? '/admin/dashboard' : '/user/dashboard';

export const operationsPath = (user, tab = '') =>
  `${user?.role === 'admin' ? '/admin' : '/user'}/operations${tab ? `?tab=${encodeURIComponent(tab)}` : ''}`;

export function accountDestination(user, target) {
  if (!user || !target?.startsWith('/user/')) return target;
  const url = new URL(target, 'https://hotel.local');
  const module = url.pathname.split('/')[2];
  if (user.role === 'admin' || user.role !== 'user') {
    if (['operations', 'reservations', 'stays', 'services', 'billing', 'feedback'].includes(module)) {
      if (module !== 'operations') url.searchParams.set('tab', module);
      return `${operationsPath(user)}${url.search}${url.hash}`;
    }
    if (user.role === 'admin') return target.replace('/user/', '/admin/');
  }
  return target;
}

export function returnPath(user, target) {
  if (typeof target !== 'string' || !/^\/(user|admin)\//.test(target) || /[\\\r\n]/.test(target)) {
    return dashboardPath(user);
  }
  if (target.startsWith('/admin/') && user.role !== 'admin') return dashboardPath(user);
  return accountDestination(user, target);
}
