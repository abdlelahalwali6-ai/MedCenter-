/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { UserRole } from "@/src/types";

export const ROLES: { label: string; value: UserRole }[] = [
  { label: "مدير النظام", value: "admin" },
  { label: "طبيب", value: "doctor" },
  { label: "ممرض", value: "nurse" },
  { label: "صيدلي", value: "pharmacist" },
  { label: "فني مختبر", value: "lab_tech" },
  { label: "موظف استقبال", value: "receptionist" },
  { label: "مريض", value: "patient" },
];

export const DEPARTMENTS = [
  "العيادة العامة",
  "عيادة الأسنان",
  "المختبر",
  "الأشعة",
  "الصيدلية",
  "الاستقبال",
  "الإدارة",
];

export const APPOINTMENT_STATUS = {
  scheduled: { label: "مجدول", color: "bg-blue-500" },
  "checked-in": { label: "تم الحضور", color: "bg-yellow-500" },
  "in-progress": { label: "قيد المعاينة", color: "bg-orange-500" },
  completed: { label: "مكتمل", color: "bg-green-500" },
  cancelled: { label: "ملغي", color: "bg-red-500" },
  "no-show": { label: "لم يحضر", color: "bg-gray-500" },
};

export const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
