// Languages the AI Assistant chat can run in. The picker changes two things:
// the language the model is told to reply in, and the static text on the chat
// screen. The rest of the app stays in English.
//
// The Shona and Ndebele strings below have not been reviewed by a native
// speaker yet — treat them as a first draft.

export type ChatLanguage = 'en' | 'sn' | 'nd';

export const DEFAULT_CHAT_LANGUAGE: ChatLanguage = 'en';

export const CHAT_LANGUAGES: { id: ChatLanguage; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'sn', label: 'ChiShona' },
  { id: 'nd', label: 'IsiNdebele' },
];

export function isChatLanguage(value: unknown): value is ChatLanguage {
  return CHAT_LANGUAGES.some((l) => l.id === value);
}

// Figures and labels that must stay in English so a reply still lines up with
// the other screens and with exported reports.
const KEEP_IN_ENGLISH =
  'Keep reference numbers, amounts, currency codes, file names, system names ' +
  '(Dynamics 365, Prism BSS) and the status labels Matched, Timing difference, ' +
  'Mis-post and Investigate exactly as they appear in the snapshot.';

const REPLY_INSTRUCTIONS: Record<ChatLanguage, string | null> = {
  en: null,
  sn:
    'Reply in Shona (chiShona, as spoken in Zimbabwe), whatever language the ' +
    'question is written in. ' +
    KEEP_IN_ENGLISH,
  nd:
    'Reply in Northern Ndebele (isiNdebele as spoken in Zimbabwe — not isiZulu ' +
    'and not Southern Ndebele), whatever language the question is written in. ' +
    KEEP_IN_ENGLISH,
};

/** Extra system-prompt text for the chosen language, or null for English. */
export function replyLanguageInstruction(
  language: ChatLanguage
): string | null {
  return REPLY_INSTRUCTIONS[language];
}

export interface ChatStrings {
  languageLabel: string;
  description: string;
  emptyState: string;
  suggestedPrompts: [string, string, string];
  placeholder: string;
  send: string;
  thinking: string;
  demoMode: string;
  genericError: string;
  groundedOn: string;
}

export const CHAT_STRINGS: Record<ChatLanguage, ChatStrings> = {
  en: {
    languageLabel: 'Language',
    description: 'Grounded in the reconciliation results currently loaded',
    emptyState:
      'Ask about matches, exceptions, or specific reference numbers. Answers are grounded in the extracts uploaded on the Data Sources page.',
    suggestedPrompts: [
      "Summarize this month's reconciliation results",
      'Which exceptions need investigation first?',
      "Why weren't the Dynamics and bank records matched?",
    ],
    placeholder: "Ask about this month's reconciliation...",
    send: 'Send',
    thinking: 'Thinking…',
    demoMode: 'Demo mode — no API key configured for this provider',
    genericError: 'Something went wrong reaching the assistant',
    groundedOn: 'Grounded on:',
  },
  sn: {
    languageLabel: 'Mutauro',
    description:
      'Mhinduro dzinobva pamhedzisiro e-reconciliation dzakaiswa parizvino',
    emptyState:
      'Bvunza nezve matches, exceptions, kana nhamba dze-reference chaidzo. Mhinduro dzinobva pamafaira akaiswa papeji reData Sources.',
    suggestedPrompts: [
      'Pfupisa mhedzisiro ye-reconciliation yemwedzi uno',
      'Ndeapi ma-exceptions anofanira kuongororwa kutanga?',
      'Sei marekodhi eDynamics neebhanga asina kuenderana?',
    ],
    placeholder: 'Bvunza nezve reconciliation yemwedzi uno...',
    send: 'Tumira',
    thinking: 'Ndiri kufunga…',
    demoMode: 'Demo mode — hapana API key yakaiswa yeprovider iyi',
    genericError: 'Pane chakanganisika pakubata assistant',
    groundedOn: 'Zvichibva pa:',
  },
  nd: {
    languageLabel: 'Ulimi',
    description:
      'Izimpendulo zisuselwa kumiphumela ye-reconciliation efakiweyo khathesi',
    emptyState:
      'Buza ngama-matches, ama-exceptions, kumbe izinombolo ze-reference ezithile. Izimpendulo zisuselwa kumafayili afakwe ekhasini le-Data Sources.',
    suggestedPrompts: [
      'Fingqa imiphumela ye-reconciliation yale inyanga',
      'Yiwaphi ama-exceptions okumele ahlolwe kuqala?',
      'Kungani amarekhodi e-Dynamics lawebhanga engahambelananga?',
    ],
    placeholder: 'Buza nge-reconciliation yale inyanga...',
    send: 'Thumela',
    thinking: 'Ngiyacabanga…',
    demoMode: 'Demo mode — akula API key efakiweyo yale provider',
    genericError: 'Kukhona okungahambanga kuhle ekufinyeleleni i-assistant',
    groundedOn: 'Kusekelwe ku:',
  },
};
