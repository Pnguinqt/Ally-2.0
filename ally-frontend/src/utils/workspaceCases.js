export function workspaceCaseGroup(item) {
  switch (String(item?.status || '').toUpperCase()) {
    case 'COMPLETED': return 'completed';
    case 'DECLINED': return 'declined';
    case 'CANCELLED': return null;
    default: return 'recent';
  }
}

export function caseActivityTimestamp(item) {
  for (const value of [item.updatedAt, item.dateSubmitted, item.createdAt]) {
    if (!value) continue;
    const timestamp = Date.parse(value);
    if (Number.isFinite(timestamp)) return timestamp;
  }
  return null;
}

export function organizeWorkspaceCases(cases, order = 'recent', now = Date.now()) {
  const days = order === 'week' ? 7 : order === 'month' ? 30 : null;
  const result = cases.filter(item => {
    if (!days) return true;
    const timestamp = caseActivityTimestamp(item);
    return timestamp !== null && timestamp >= now - days * 86400000 && timestamp <= now;
  });
  return result.sort((a, b) => {
    if (order === 'case') {
      const titleOrder = (a.title || `Case #${a.caseId}`).localeCompare(b.title || `Case #${b.caseId}`, undefined, { numeric: true, sensitivity: 'base' });
      if (titleOrder) return titleOrder;
    }
    return (caseActivityTimestamp(b) ?? 0) - (caseActivityTimestamp(a) ?? 0) || Number(b.caseId) - Number(a.caseId);
  });
}
