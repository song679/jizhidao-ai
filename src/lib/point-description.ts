const ADMIN_PREFIX_PATTERN = /^【操作管理员：(.+?)】\s*/;

export function createAdminPointDescription(
  adminEmail: string,
  note: string
) {
  const safeEmail = adminEmail.trim().toLowerCase().slice(0, 200);
  const safeNote = note.trim().slice(0, 200);
  return `【操作管理员：${safeEmail}】${safeNote}`;
}

export function parsePointDescription(description: string | null) {
  if (!description) {
    return {
      adminEmail: null,
      note: "",
    };
  }

  const match = description.match(ADMIN_PREFIX_PATTERN);

  return {
    adminEmail: match?.[1]?.trim() || null,
    note: match
      ? description.replace(ADMIN_PREFIX_PATTERN, "").trim()
      : description,
  };
}
