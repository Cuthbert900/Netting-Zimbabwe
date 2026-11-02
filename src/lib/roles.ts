export type UserRole =
  | 'admin'
  | 'user'
  | 'reconciliation_reviewer'
  | 'data_uploader'
  | 'report_viewer';

export const ROLES = {
  ADMIN: 'admin',
  USER: 'user',
  RECONCILIATION_REVIEWER: 'reconciliation_reviewer',
  DATA_UPLOADER: 'data_uploader',
  REPORT_VIEWER: 'report_viewer',
} as const;

export const ROLE_HIERARCHY: Record<UserRole, UserRole[]> = {
  admin: [
    ROLES.USER,
    ROLES.RECONCILIATION_REVIEWER,
    ROLES.DATA_UPLOADER,
    ROLES.REPORT_VIEWER,
  ],
  user: [ROLES.REPORT_VIEWER],
  reconciliation_reviewer: [ROLES.REPORT_VIEWER],
  data_uploader: [],
  report_viewer: [],
};

/**
 * Checks if a user with the given role has the required permission.
 * @param userRole The role of the user.
 * @param requiredRole The role required for the action.
 * @returns True if the user has the required permission, false otherwise.
 */
export function hasPermission(
  userRole: UserRole,
  requiredRole: UserRole
): boolean {
  if (userRole === ROLES.ADMIN) {
    return true;
  }
  if (userRole === requiredRole) {
    return true;
  }
  return ROLE_HIERARCHY[userRole]?.includes(requiredRole) ?? false;
}
