/**
 * Server-side Pi model foundation for Ruang.
 *
 * This module is a factory only. It creates the pi-ai catalog and resolves
 * one fixed model. It never calls a model and it never reads a credential.
 *
 * Fixed choice:
 * - provider: `zai` (Z.AI), the built-in provider of `@earendil-works/pi-ai`
 * - model: `glm-5.3-flash`, a model of that provider's built-in catalog
 *
 * No custom model registration is needed. The catalog entry ships with
 * pi-ai 1.4.0. The provider reads the credential from `ZAI_API_KEY` at
 * request time, not here.
 *
 * The Vercel AI Gateway models are not used. The MiniMax provider is a
 * separate concern for the audit workers.
 */
import { createModels, type MutableModels } from '@earendil-works/pi-ai/models';
import { zaiProvider } from '@earendil-works/pi-ai/providers/zai';
import type { Api, Model } from '@earendil-works/pi-ai';

/** Provider id of the Pi model. Fixed. */
export const PI_PROVIDER_ID = 'zai';

/** Model id of the Pi model. Fixed. */
export const PI_MODEL_ID = 'glm-5.3-flash';

/** A Pi model reference, in the shape pi-durable stores in a conversation. */
export type PiModelRef = {
  readonly provider: string;
  readonly modelId: string;
};

/** The fixed Pi model reference. */
export const PI_MODEL_REF: PiModelRef = {
  provider: PI_PROVIDER_ID,
  modelId: PI_MODEL_ID,
};

/**
 * Create the pi-ai catalog for the Pi agent.
 *
 * The catalog holds the `zai` provider only. `createModels()` starts empty,
 * so the provider must be set. The credential is not read here.
 */
export function createPiModels(): MutableModels {
  const models = createModels();
  models.setProvider(zaiProvider());
  return models;
}

/**
 * Resolve the fixed Pi model from a catalog.
 *
 * The model must be in the catalog. The call needs no credential and no
 * network. It throws when the model is missing.
 */
export function resolvePiModel(models: MutableModels): Model<Api> {
  const model = models.getModel(PI_PROVIDER_ID, PI_MODEL_ID);
  if (model === undefined) {
    throw new Error(
      `Pi model is not in the catalog: ${PI_PROVIDER_ID}/${PI_MODEL_ID}`
    );
  }
  return model;
}

/**
 * Check that the fixed Pi model is in a catalog.
 *
 * It returns true or false. It never throws and it never calls a model.
 */
export function hasPiModel(models: MutableModels): boolean {
  return models.getModel(PI_PROVIDER_ID, PI_MODEL_ID) !== undefined;
}
