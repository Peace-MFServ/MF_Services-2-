// ─────────────────────────────────────────────────────────────────
// MF Services — the details every quote carries
// ─────────────────────────────────────────────────────────────────
// From the quote template Liam approved (V4, November 2026): the
// licence number, the validity, the contact line in the footer and the
// payment methods on the customer's second page. One place, so the
// PDFs and the spreadsheets cannot disagree.
// ─────────────────────────────────────────────────────────────────

export const COMPANY = {
  name: "MF Services",
  licenceNo: "5620",
  validity: "Valid for 30 days",
  website: "www.mfservices.ie",
  phone: "021 434 8996",
  email: "contact@mfservices.ie",
  addressLine: "Unit 26 Doughcloyne Ind. Est.",
  town: "Wilton, Co. Cork, T12 H763",
  footerAddress: "MF Services, Unit 26 Doughcloyne Ind. Est., Cork T12 H763",
  bank: {
    name: "AIB",
    accountName: ["Michael Foy Philips Services", "Cork Limited T/A MF Services"],
    iban: "IE03AIBK93638343211046",
  },
};

/** The footer line on every page. */
export const footerLine = () =>
  `${COMPANY.website}  ·  ${COMPANY.phone}  ·  ${COMPANY.email}  ·  ${COMPANY.footerAddress}`;

/** What the quote is for, under "Service description". */
export const SERVICE_HEADING = "Steel Doorsets — Supply and Install";
