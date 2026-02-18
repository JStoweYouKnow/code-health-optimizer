export function usedHelper(msg: string) {
  return msg.toUpperCase();
}

// Dead code - never called
function deadHelper() {
  return 'never used';
}

// Another unreferenced function
function orphanUtil() {
  return 42;
}
