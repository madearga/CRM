/**
 * The Pi agent foundation of Ruang.
 *
 * The exports are server-side only. The model factory is fixed to the Z.AI
 * provider and the `glm-5.3-flash` model. The harness factory is minimal: it
 * has no coding tools, no shell, and no environment.
 */
export {
  PI_MODEL_ID,
  PI_MODEL_REF,
  PI_PROVIDER_ID,
  createPiModels,
  hasPiModel,
  resolvePiModel,
  type PiModelRef,
} from './pi-model';
export {
  PI_AGENT,
  createPiRegistry,
  openPiHarness,
  type PiHarnessOptions,
} from './pi-harness';
export {
  PROPOSE_OPERATION_EXTENSION_NAME,
  PROPOSE_OPERATION_TOOL_NAME,
  createProposeOperationTool,
  type ProposeOperationHandler,
  type ProposeOperationOutcome,
  type ProposeOperationProposal,
  type ProposeOperationTool,
} from './propose-operation';

// The bridge and the room turn are server-side only. The bridge reads the
// service secret, so it must never reach a client bundle.
export {
  BRIDGE_MESSAGE_PATH,
  BRIDGE_PROPOSAL_PATH,
  BRIDGE_SIGNATURE_HEADER,
  BRIDGE_SIGNATURE_VERSION,
  BRIDGE_TIMESTAMP_HEADER,
  bridgeCall,
  buildBridgeHeaders,
  buildSignature,
  buildSignatureHeader,
  buildSigningText,
  toSignaturePath,
  type BridgeCallOptions,
  type BridgeEnvelope,
} from './bridge';
export {
  AGENT_TURN_TIMEOUT_MS,
  AgentTurnTimeoutError,
  buildAgentInstructions,
  extractReplyText,
  runAgentTurn,
  type AgentTurnInput,
  type AgentTurnResult,
} from './agent-turn';
export {
  authorLabel,
  buildProposalSummary,
  formatTranscript,
  formatTranscriptMessage,
  toOperationKind,
  type TranscriptMessage,
} from './transcript';
