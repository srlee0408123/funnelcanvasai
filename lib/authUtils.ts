/**
 * @deprecated Use ErrorDetectors.isUnauthorizedError from @/lib/messages/toast-utils instead
 */
export function isUnauthorizedError(error: Error): boolean {
  return /^401: .*Unauthorized/.test(error.message);
}