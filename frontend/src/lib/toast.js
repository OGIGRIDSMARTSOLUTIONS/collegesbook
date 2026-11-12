const listeners = new Set();
let nextId = 0;

export function subscribeToasts(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const toast = {
  show(message, type = 'info') {
    const item = { id: ++nextId, message: String(message), type };
    listeners.forEach((listener) => listener(item));
    return item.id;
  },
  success(message) { return this.show(message, 'success'); },
  error(message) { return this.show(message, 'error'); },
  warning(message) { return this.show(message, 'warning'); },
  info(message) { return this.show(message, 'info'); },
};
