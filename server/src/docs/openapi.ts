import { OpenAPIRegistry, OpenApiGeneratorV3, extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z, type ZodTypeAny } from 'zod';
import * as S from '@hajira/shared';

extendZodWithOpenApi(z);

/**
 * OpenAPI document generated from the same zod schemas the API validates with.
 * Routes are declared in one table so the docs stay next to each other and
 * cheap to keep in sync with the routers.
 */

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';
interface RouteDoc {
  method: Method;
  path: string;
  tag: string;
  summary: string;
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  auth?: boolean;
  roles?: string;
  multipart?: boolean;
  file?: boolean;
}

const pathId = z.object({ id: z.string() });

const routes: RouteDoc[] = [
  // Auth
  { method: 'post', path: '/auth/register', tag: 'Auth', summary: 'Register (account starts PENDING until HR approves)', body: S.registerSchema, auth: false },
  { method: 'post', path: '/auth/login', tag: 'Auth', summary: 'Sign in; sets httpOnly access + refresh cookies', body: S.loginSchema, auth: false },
  { method: 'post', path: '/auth/refresh', tag: 'Auth', summary: 'Rotate the refresh token (cookie)', auth: false },
  { method: 'post', path: '/auth/logout', tag: 'Auth', summary: 'Revoke the refresh token and clear cookies', auth: false },
  { method: 'get', path: '/auth/me', tag: 'Auth', summary: 'Current user' },
  { method: 'post', path: '/auth/verify-email', tag: 'Auth', summary: 'Confirm email with the emailed token', body: S.verifyEmailSchema, auth: false },
  { method: 'post', path: '/auth/resend-verification', tag: 'Auth', summary: 'Send a new verification link', body: S.forgotPasswordSchema, auth: false },
  { method: 'post', path: '/auth/forgot-password', tag: 'Auth', summary: 'Email a reset link (expires in 15 min)', body: S.forgotPasswordSchema, auth: false },
  { method: 'post', path: '/auth/reset-password', tag: 'Auth', summary: 'Set a new password with the reset token', body: S.resetPasswordSchema, auth: false },
  { method: 'post', path: '/auth/accept-invite', tag: 'Auth', summary: 'Activate an invited account', body: S.acceptInviteSchema, auth: false },
  { method: 'post', path: '/auth/change-password', tag: 'Auth', summary: 'Change password (signs out other devices)', body: S.changePasswordSchema },

  // Users
  { method: 'get', path: '/users/me', tag: 'Users', summary: 'My profile' },
  { method: 'patch', path: '/users/me', tag: 'Users', summary: 'Update my profile', body: S.updateProfileSchema },
  { method: 'post', path: '/users/me/avatar', tag: 'Users', summary: 'Upload my photo (jpg/png/webp, field "file")', file: true },
  { method: 'get', path: '/users', tag: 'Users', summary: 'List employees (HR: all, manager: team)', query: S.userListQuery, roles: 'MANAGER, HR, ADMIN' },
  { method: 'get', path: '/users/options', tag: 'Users', summary: 'Active people for pickers', roles: 'MANAGER, HR, ADMIN' },
  { method: 'get', path: '/users/{id}', tag: 'Users', summary: 'Employee detail' },
  { method: 'post', path: '/users/invite', tag: 'Users', summary: 'Invite an employee by email', body: S.inviteUserSchema, roles: 'HR, ADMIN' },
  { method: 'post', path: '/users/{id}/resend-invite', tag: 'Users', summary: 'Resend an invitation', roles: 'HR, ADMIN' },
  { method: 'post', path: '/users/{id}/approve', tag: 'Users', summary: 'Approve a pending registration', body: S.approveAccountSchema, roles: 'HR, ADMIN' },
  { method: 'post', path: '/users/{id}/reject', tag: 'Users', summary: 'Reject a pending registration', body: S.rejectSchema, roles: 'HR, ADMIN' },
  { method: 'patch', path: '/users/{id}', tag: 'Users', summary: 'Update employee (role changes are audited)', body: S.updateUserSchema, roles: 'HR, ADMIN' },
  { method: 'delete', path: '/users/{id}', tag: 'Users', summary: 'Soft-delete an employee', roles: 'HR, ADMIN' },

  // Organisation
  { method: 'get', path: '/departments/options', tag: 'Organisation', summary: 'Departments for selects (public)', auth: false },
  { method: 'get', path: '/departments', tag: 'Organisation', summary: 'List departments', query: S.paginationQuery },
  { method: 'post', path: '/departments', tag: 'Organisation', summary: 'Create department', body: S.departmentSchema, roles: 'HR, ADMIN' },
  { method: 'put', path: '/departments/{id}', tag: 'Organisation', summary: 'Update department', body: S.departmentSchema, roles: 'HR, ADMIN' },
  { method: 'delete', path: '/departments/{id}', tag: 'Organisation', summary: 'Soft-delete department (must be empty)', roles: 'HR, ADMIN' },
  { method: 'get', path: '/designations/options', tag: 'Organisation', summary: 'Designations for selects (public)', auth: false },
  { method: 'get', path: '/designations', tag: 'Organisation', summary: 'List designations', query: S.paginationQuery, roles: 'HR, ADMIN' },
  { method: 'post', path: '/designations', tag: 'Organisation', summary: 'Create designation', body: S.designationSchema, roles: 'HR, ADMIN' },
  { method: 'put', path: '/designations/{id}', tag: 'Organisation', summary: 'Update designation', body: S.designationSchema, roles: 'HR, ADMIN' },
  { method: 'delete', path: '/designations/{id}', tag: 'Organisation', summary: 'Delete designation', roles: 'HR, ADMIN' },
  { method: 'get', path: '/shifts', tag: 'Shifts', summary: 'List shifts' },
  { method: 'post', path: '/shifts', tag: 'Shifts', summary: 'Create shift', body: S.shiftSchema, roles: 'HR, ADMIN' },
  { method: 'put', path: '/shifts/{id}', tag: 'Shifts', summary: 'Update shift', body: S.shiftSchema, roles: 'HR, ADMIN' },
  { method: 'delete', path: '/shifts/{id}', tag: 'Shifts', summary: 'Deactivate shift', roles: 'HR, ADMIN' },
  { method: 'post', path: '/shifts/{id}/assign', tag: 'Shifts', summary: 'Assign to employees or a department', body: S.assignShiftSchema, roles: 'HR, ADMIN' },
  { method: 'get', path: '/holidays', tag: 'Holidays', summary: 'Holidays for a year', query: z.object({ year: z.number().optional() }) },
  { method: 'post', path: '/holidays', tag: 'Holidays', summary: 'Add holiday', body: S.holidaySchema, roles: 'HR, ADMIN' },
  { method: 'put', path: '/holidays/{id}', tag: 'Holidays', summary: 'Update holiday', body: S.holidaySchema, roles: 'HR, ADMIN' },
  { method: 'delete', path: '/holidays/{id}', tag: 'Holidays', summary: 'Remove holiday', roles: 'HR, ADMIN' },

  // Attendance
  { method: 'get', path: '/attendance/today', tag: 'Attendance', summary: "Today's shift window, status and allowed actions" },
  { method: 'post', path: '/attendance/check-in', tag: 'Attendance', summary: 'Check in (server timestamp; late detection)' },
  { method: 'post', path: '/attendance/check-out', tag: 'Attendance', summary: 'Check out (work, early-leave, overtime, half-day)' },
  { method: 'get', path: '/attendance/month', tag: 'Attendance', summary: 'Month of days with statuses', query: z.object({ month: z.string().optional(), userId: z.string().optional() }) },
  { method: 'get', path: '/attendance', tag: 'Attendance', summary: 'Attendance records (team/company)', query: S.attendanceListQuery, roles: 'MANAGER, HR, ADMIN' },
  { method: 'patch', path: '/attendance/{id}', tag: 'Attendance', summary: 'Edit a record (audited)', body: S.attendanceEditSchema, roles: 'HR, ADMIN' },
  { method: 'get', path: '/regularizations', tag: 'Regularization', summary: 'Correction requests', query: S.requestListQuery },
  { method: 'post', path: '/regularizations', tag: 'Regularization', summary: 'Request an attendance correction', body: S.regularizationSchema },
  { method: 'post', path: '/regularizations/{id}/approve', tag: 'Regularization', summary: 'Approve (updates attendance, audited)', body: S.reviewSchema, roles: 'MANAGER, HR, ADMIN' },
  { method: 'post', path: '/regularizations/{id}/reject', tag: 'Regularization', summary: 'Reject with comment', body: S.rejectSchema, roles: 'MANAGER, HR, ADMIN' },
  { method: 'post', path: '/regularizations/{id}/cancel', tag: 'Regularization', summary: 'Cancel my pending request' },

  // Leave
  { method: 'get', path: '/leave-types', tag: 'Leave', summary: 'Leave types' },
  { method: 'post', path: '/leave-types', tag: 'Leave', summary: 'Create leave type', body: S.leaveTypeSchema, roles: 'HR, ADMIN' },
  { method: 'put', path: '/leave-types/{id}', tag: 'Leave', summary: 'Update leave type', body: S.leaveTypeSchema, roles: 'HR, ADMIN' },
  { method: 'delete', path: '/leave-types/{id}', tag: 'Leave', summary: 'Archive leave type', roles: 'HR, ADMIN' },
  { method: 'get', path: '/leave/balances', tag: 'Leave', summary: 'Balances for a year', query: z.object({ year: z.number().optional(), userId: z.string().optional() }) },
  { method: 'post', path: '/leave/balances/adjust', tag: 'Leave', summary: 'Adjust a balance (audited)', body: S.balanceAdjustSchema, roles: 'HR, ADMIN' },
  { method: 'post', path: '/leave/requests/preview', tag: 'Leave', summary: 'Day count (weekends/holidays excluded) and problems', body: S.leavePreviewSchema },
  { method: 'get', path: '/leave/requests', tag: 'Leave', summary: 'Leave requests (mine / approvals / all)', query: S.leaveListQuery },
  { method: 'post', path: '/leave/requests', tag: 'Leave', summary: 'Apply for leave', body: S.applyLeaveSchema },
  { method: 'get', path: '/leave/requests/{id}', tag: 'Leave', summary: 'Request detail with approval chain' },
  { method: 'post', path: '/leave/requests/{id}/approve', tag: 'Leave', summary: 'Approve current level (final level deducts balance)', body: S.reviewSchema, roles: 'MANAGER, HR, ADMIN' },
  { method: 'post', path: '/leave/requests/{id}/reject', tag: 'Leave', summary: 'Reject with comment', body: S.rejectSchema, roles: 'MANAGER, HR, ADMIN' },
  { method: 'post', path: '/leave/requests/{id}/cancel', tag: 'Leave', summary: 'Cancel my pending request' },
  { method: 'get', path: '/leave/calendar', tag: 'Leave', summary: 'Team calendar events (leave + holidays)', query: S.calendarQuery },
  { method: 'post', path: '/leave/attachments', tag: 'Leave', summary: 'Upload a leave attachment (pdf/jpg/png/webp, field "file")', file: true },

  // System
  { method: 'get', path: '/notifications', tag: 'Notifications', summary: 'My notifications' },
  { method: 'get', path: '/notifications/unread-count', tag: 'Notifications', summary: 'Unread count for the bell' },
  { method: 'post', path: '/notifications/read-all', tag: 'Notifications', summary: 'Mark all read' },
  { method: 'post', path: '/notifications/{id}/read', tag: 'Notifications', summary: 'Mark one read' },
  { method: 'get', path: '/settings', tag: 'Settings', summary: 'Company settings' },
  { method: 'put', path: '/settings', tag: 'Settings', summary: 'Update settings (IP restriction, late policy, approval flow, timezone)', body: S.settingsSchema, roles: 'HR, ADMIN' },
  { method: 'get', path: '/audit-logs', tag: 'Audit', summary: 'Audit trail', query: S.paginationQuery, roles: 'HR, ADMIN' },
  { method: 'get', path: '/dashboard/employee', tag: 'Dashboards', summary: 'Employee dashboard' },
  { method: 'get', path: '/dashboard/manager', tag: 'Dashboards', summary: 'Manager dashboard', roles: 'MANAGER, HR, ADMIN' },
  { method: 'get', path: '/dashboard/admin', tag: 'Dashboards', summary: 'HR/Admin dashboard', roles: 'HR, ADMIN' },
  { method: 'get', path: '/reports/monthly', tag: 'Reports', summary: 'Monthly attendance sheet (format=json|xlsx|pdf)', query: S.reportQuery, roles: 'MANAGER, HR, ADMIN' },
  { method: 'get', path: '/reports/late', tag: 'Reports', summary: 'Late report (format=json|xlsx|pdf)', query: S.reportQuery, roles: 'MANAGER, HR, ADMIN' },
  { method: 'get', path: '/reports/leave', tag: 'Reports', summary: 'Leave report (format=json|xlsx|pdf)', query: S.reportQuery, roles: 'MANAGER, HR, ADMIN' },
];

const envelope = z.object({
  success: z.boolean(),
  data: z.unknown(),
  message: z.string(),
  meta: z.object({ page: z.number(), limit: z.number(), total: z.number(), totalPages: z.number() }).optional(),
});
const errorEnvelope = z.object({
  success: z.literal(false),
  data: z.null(),
  message: z.string(),
  code: z.string(),
  errors: z.record(z.array(z.string())).optional(),
});

/** zod refinements (ZodEffects) are not objects; unwrap to their inner object for docs. */
function unwrap(schema: ZodTypeAny): ZodTypeAny {
  let s = schema;
  while (s._def?.schema) s = s._def.schema;
  return s;
}

export function buildOpenApiDocument() {
  const registry = new OpenAPIRegistry();
  registry.registerComponent('securitySchemes', 'cookieAuth', { type: 'apiKey', in: 'cookie', name: 'hj_at' });
  registry.registerComponent('securitySchemes', 'bearerAuth', { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' });
  const Envelope = registry.register('Envelope', envelope);
  const ErrorEnvelope = registry.register('Error', errorEnvelope);

  for (const r of routes) {
    const hasId = r.path.includes('{id}');
    const query = r.query ? unwrap(r.query) : undefined;
    registry.registerPath({
      method: r.method,
      path: `/api/v1${r.path}`,
      tags: [r.tag],
      summary: r.summary,
      description: r.roles ? `Roles: ${r.roles}` : undefined,
      security: r.auth === false ? [] : [{ cookieAuth: [] }, { bearerAuth: [] }],
      request: {
        ...(hasId ? { params: pathId } : {}),
        ...(query && query instanceof z.ZodObject ? { query } : {}),
        ...(r.body ? { body: { content: { 'application/json': { schema: r.body } } } } : {}),
        ...(r.file
          ? { body: { content: { 'multipart/form-data': { schema: z.object({ file: z.string().openapi({ format: 'binary' }) }) } } } }
          : {}),
      },
      responses: {
        200: { description: 'Success', content: { 'application/json': { schema: Envelope } } },
        400: { description: 'Bad request', content: { 'application/json': { schema: ErrorEnvelope } } },
        401: { description: 'Not signed in', content: { 'application/json': { schema: ErrorEnvelope } } },
        403: { description: 'Forbidden', content: { 'application/json': { schema: ErrorEnvelope } } },
        422: { description: 'Validation failed', content: { 'application/json': { schema: ErrorEnvelope } } },
      },
    });
  }

  return new OpenApiGeneratorV3(registry.definitions).generateDocument({
    openapi: '3.0.3',
    info: {
      title: 'Hajira API',
      version: '1.0.0',
      description:
        'Attendance & leave management. Every response uses `{ success, data, message, meta? }`. Sign in with POST /auth/login; the browser keeps the httpOnly cookies, so "Try it out" works from this page.',
    },
    servers: [{ url: '/' }],
  });
}
