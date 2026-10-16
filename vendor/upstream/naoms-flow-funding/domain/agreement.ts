// src/packages/flow-funding/domain/agreement.ts — 1644 M2 flow-agreement domain.
//
// A flow-agreement is ONE object spanning a formality dial (design §6.1): at the
// informal end a relational trust-weight / channel (Simon's watershed); at the
// formal end a codified revenue-share contract (Tree's %/duration/expiry, optional
// IOU). One primitive, two ends — the `formality` scalar + `tier` label place a
// given agreement on the dial; the optional `sharePct`/`expiresAt`/`iou` fields
// populate as the dial moves toward the codified end.
//
// Bilateral two-lane: the proposer writes `flow.agreement_proposed` on the
// bilateral friendship chain; the counterparty writes `flow.agreement_accepted`
// on the SAME chain. Each party signs its own commit (its lane) — NOT an
// open-multi-writer chain (D-WRITER-MODEL). Both reference one `agreementId`; the
// fold marks the agreement `active` only when both lanes are present.

/** Where an agreement sits on the formality dial (informal → codified). */
export type FlowAgreementTier =
  | "relational" // pure trust-weight / channel (informal end)
  | "channel" // a named flow channel with soft terms
  | "revenue-share" // codified % share
  | "contract"; // fully codified contract (duration/expiry/IOU)

/** Lifecycle status folded from the two lanes. */
export type FlowAgreementStatus = "proposed" | "active" | "revoked";

/** The terms object — one shape spanning both ends of the dial. */
export interface FlowAgreementTerms {
  /** Position on the formality dial: 0 = relational, 1 = codified contract. */
  formality: number;
  tier: FlowAgreementTier;
  /** Revenue-share fraction 0..1 (codified end). */
  sharePct?: number;
  /** Agreement duration in ms (codified end). */
  durationMs?: number;
  /** ISO expiry timestamp (codified end). */
  expiresAt?: string;
  /** IOU end: reuse the `iou` token kind → negative-until-cleared. */
  iou?: boolean;
  /** The `iou`-kind tokenId created for this agreement (when iou is set). */
  iouTokenId?: string;
  note?: string;
}

/** Payload appended as `flow.agreement_proposed` (proposer's lane). */
export interface FlowAgreementProposedPayload {
  agreementId: string;
  proposer: string; // proposer DID
  counterparty: string; // counterparty DID
  terms: FlowAgreementTerms;
  /** Stable graph entity id == agreementId (so both lanes project one node). */
  id: string;
}

/** Payload appended as `flow.agreement_accepted` (counterparty's lane). */
export interface FlowAgreementAcceptedPayload {
  agreementId: string;
  accepter: string; // counterparty DID (the lane's signer)
  id: string; // == agreementId
}

/** Payload appended as `flow.agreement_revoked` (either lane). */
export interface FlowAgreementRevokedPayload {
  agreementId: string;
  revoker: string;
  id: string; // == agreementId
}

/** The projected `flow_agreement` graph node (folded from both lanes). */
export interface FlowAgreementNode {
  nodeType: "flow_agreement";
  agreementId: string;
  proposer?: string;
  counterparty?: string;
  accepter?: string;
  status: FlowAgreementStatus;
  termsJson?: string;
}

/** A deterministic-but-unique agreement id for a (proposer, counterparty) pair.
 *  The nonce keeps successive agreements between the same pair distinct. */
export function flowAgreementId(
  proposer: string,
  counterparty: string,
  nonce: string,
): string {
  return `flow-agreement-${proposer}-${counterparty}-${nonce}`;
}

/** Loud validation of agreement terms (Honesty axiom — no silent clamp). Returns
 *  an error string, or null when the terms are well-formed. */
export function validateFlowAgreementTerms(
  terms: FlowAgreementTerms | undefined,
): string | null {
  if (!terms || typeof terms !== "object") return "terms required";
  if (
    typeof terms.formality !== "number" || terms.formality < 0 ||
    terms.formality > 1
  ) {
    return "terms.formality must be a number in [0,1] (the dial)";
  }
  const tiers: FlowAgreementTier[] = [
    "relational",
    "channel",
    "revenue-share",
    "contract",
  ];
  if (!tiers.includes(terms.tier)) {
    return `terms.tier must be one of ${tiers.join("/")}`;
  }
  if (
    terms.sharePct !== undefined &&
    (terms.sharePct < 0 || terms.sharePct > 1)
  ) {
    return "terms.sharePct must be a fraction in [0,1]";
  }
  if (terms.durationMs !== undefined && terms.durationMs <= 0) {
    return "terms.durationMs must be positive";
  }
  return null;
}

/** True when both lanes are present on a folded node — proposer terms AND the
 *  counterparty's acceptance (accepter must equal the named counterparty). */
export function bothLanesPresent(node: {
  proposer?: string;
  counterparty?: string;
  accepter?: string;
}): boolean {
  return !!node.proposer && !!node.counterparty && !!node.accepter &&
    node.accepter === node.counterparty;
}
