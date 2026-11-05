// Match identity and role, never display names (which need not be unique).
export function assignedToMember(row, role, userId) {
  if (!userId) return false;
  return role === 'editor' ? row.editorId === userId : role === 'designer' ? row.designerId === userId : false;
}

export function memberQueuePatch(state, viewKey, viewState) {
  return {
    nav: 'projects', openJob: '', person: '__me', q: '', unreadOnly: false,
    menu: '', todos: false, closed: {},
    // Clear obstructing filters for this visit without overwriting saved views.
    vs: { ...state.vs, [viewKey]: { ...viewState, filter: null, advanced: null, hideEmpty: false } },
  };
}
