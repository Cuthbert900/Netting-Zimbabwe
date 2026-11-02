import { describe, it, expect } from 'vitest';
import {
  CHAT_LANGUAGES,
  CHAT_STRINGS,
  isChatLanguage,
  replyLanguageInstruction,
} from './chat-language';

describe('chat language', () => {
  it('accepts only the supported language ids', () => {
    expect(isChatLanguage('en')).toBe(true);
    expect(isChatLanguage('sn')).toBe(true);
    expect(isChatLanguage('nd')).toBe(true);
    expect(isChatLanguage('zu')).toBe(false);
    expect(isChatLanguage(undefined)).toBe(false);
  });

  it('adds no reply instruction for English', () => {
    expect(replyLanguageInstruction('en')).toBeNull();
  });

  it('tells the model to reply in Shona or Ndebele and keep status labels in English', () => {
    const sn = replyLanguageInstruction('sn');
    const nd = replyLanguageInstruction('nd');
    expect(sn).toContain('Shona');
    expect(nd).toContain('Northern Ndebele');
    for (const instruction of [sn, nd]) {
      expect(instruction).toContain('Investigate');
      expect(instruction).toContain('Dynamics 365');
    }
  });

  it('has every screen string filled in for every language', () => {
    const keys = Object.keys(CHAT_STRINGS.en).sort();
    for (const { id } of CHAT_LANGUAGES) {
      const strings = CHAT_STRINGS[id];
      expect(Object.keys(strings).sort()).toEqual(keys);
      expect(strings.suggestedPrompts).toHaveLength(3);
      for (const value of Object.values(strings).flat()) {
        expect(value.trim()).not.toBe('');
      }
    }
  });
});
