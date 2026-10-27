import type { AppointmentStatus, EnquiryStatus, EnquirySource, AutomationKind } from "@prisma/client";

export const ENQUIRY_STATUS_LABELS: Record<EnquiryStatus, string> = {
  NEW: "New",
  AWAITING_RESPONSE: "Awaiting response",
  CONTACTED: "Contacted",
  QUOTED: "Quoted",
  BOOKED: "Booked",
  CLOSED: "Closed",
  LOST: "Lost",
};

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  REQUESTED: "Requested",
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  CANCELLED: "Cancelled",
  COMPLETED: "Completed",
};

export const ENQUIRY_SOURCE_LABELS: Record<EnquirySource, string> = {
  BOOKING_PAGE: "Booking page",
  DEMO: "Demo",
  MANUAL: "Manual",
  WEBSITE: "Website",
  PHONE: "Phone",
  WHATSAPP: "WhatsApp",
  INSTAGRAM: "Instagram",
  EMAIL: "Email",
  OTHER: "Other",
};

export const AUTOMATION_KIND_LABELS: Record<AutomationKind, string> = {
  OWNER_NEW_ENQUIRY: "Notify owner on new enquiry",
  OWNER_UNANSWERED_REMINDER: "Owner unanswered reminder",
  CUSTOMER_APPOINTMENT_REMINDER: "Customer appointment reminder",
  QUOTE_FOLLOW_UP_FLAG: "Quote follow-up flag",
};

export function enquiryBadgeVariant(
  status: EnquiryStatus,
): "default" | "accent" | "muted" | "danger" | "success" {
  switch (status) {
    case "NEW":
      return "accent";
    case "AWAITING_RESPONSE":
      return "default";
    case "BOOKED":
      return "success";
    case "LOST":
      return "danger";
    default:
      return "muted";
  }
}

export function appointmentBadgeVariant(
  status: AppointmentStatus,
): "default" | "accent" | "muted" | "danger" | "success" {
  switch (status) {
    case "CONFIRMED":
      return "success";
    case "REQUESTED":
    case "PENDING":
      return "accent";
    case "CANCELLED":
      return "danger";
    case "COMPLETED":
      return "muted";
    default:
      return "default";
  }
}
