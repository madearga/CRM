/**
 * Tests of the Pi model foundation.
 *
 * The tests need no credential and no network. They read the built-in
 * catalog of pi-ai only. They never call a model.
 */
import { describe, it, expect } from 'vitest';
import {
  PI_MODEL_ID,
  PI_MODEL_REF,
  PI_PROVIDER_ID,
  createPiModels,
  hasPiModel,
  resolvePiModel,
} from '../../apps/web/src/lib/agents/pi-model';

describe('Pi model foundation', () => {
  it('fixes the provider and the model', () => {
    expect(PI_PROVIDER_ID).toBe('zai');
    expect(PI_MODEL_ID).toBe('glm-5.3-flash');
    expect(PI_MODEL_REF).toEqual({ provider: 'zai', modelId: 'glm-5.3-flash' });
  });

  it('resolves the model from the built-in catalog', () => {
    const models = createPiModels();
    expect(hasPiModel(models)).toBe(true);

    const model = resolvePiModel(models);
    expect(model.id).toBe('glm-5.3-flash');
    expect(model.provider).toBe('zai');
    expect(model.api).toBe('openai-completions');
  });

  it('resolves the model without a credential', () => {
    const key = process.env.ZAI_API_KEY;
    delete process.env.ZAI_API_KEY;
    try {
      const models = createPiModels();
      expect(resolvePiModel(models).id).toBe('glm-5.3-flash');
    } finally {
      if (key !== undefined) {
        process.env.ZAI_API_KEY = key;
      }
    }
  });

  it('holds no gateway model and no other provider', () => {
    const models = createPiModels();

    expect(
      models.getModel('vercel-ai-gateway', 'anthropic/claude-sonnet-4.5')
    ).toBeUndefined();
    expect(models.getModel('openai', 'gpt-4.1')).toBeUndefined();

    const providers = new Set(
      models.getModelsOfType('chat').map((model) => model.provider)
    );
    expect([...providers]).toEqual(['zai']);
  });

  it('fails loudly when the model is missing', () => {
    const models = createPiModels();
    models.deleteProvider('zai');

    expect(hasPiModel(models)).toBe(false);
    expect(() => resolvePiModel(models)).toThrow(/not in the catalog/);
  });
});
