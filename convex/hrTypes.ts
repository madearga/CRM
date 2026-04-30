import { zid } from 'convex-helpers/server/zod';
import { z } from 'zod';

export const employeeStatusSchema = z.enum(['active', 'on_leave', 'resigned']);
export const attendanceStatusSchema = z.enum(['present', 'absent', 'on_leave', 'holiday']);
export const attendanceLabelSchema = z.enum([
  'on_time',
  'late',
  'early_leave',
  'no_shift',
  'forgot_clockout',
  'outside_area',
]);
export const correctionStatusSchema = z.enum(['pending', 'approved', 'rejected']);
export const shiftRecurrenceSchema = z.enum(['once', 'weekly']);
export const clockInSourceSchema = z.enum(['whatsapp', 'web', 'kiosk']);

export const locationSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  accuracy: z.number().optional(),
});

export const branchOutputSchema = z.object({
  id: zid('branches'),
  name: z.string(),
  address: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  qrCode: z.string(),
  isActive: z.boolean(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const employeeOutputSchema = z.object({
  id: zid('employees'),
  name: z.string(),
  nik: z.string(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  position: z.string(),
  department: z.string().nullable().optional(),
  whatsappNumber: z.string().nullable().optional(),
  status: employeeStatusSchema,
  branchId: zid('branches'),
  userId: zid('user').nullable().optional(),
  hireDate: z.number().nullable().optional(),
  resignDate: z.number().nullable().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});
