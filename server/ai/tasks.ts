/**
 * AI tasks and which models each may use (docs/ENGINE.md §11.1). Defaults keep cost low:
 * gpt-6-luna everywhere, omni-moderation-latest for safety. Stronger models are opt-in per task.
 */
export const TASKS = {
  decide: {
    label: 'Read player text and NPC choices (Decisions)',
    api: 'decisions',
    default: 'gpt-6-luna',
    allowed: ['gpt-6-luna'],
    generate: false,
  },
  moderate: {
    label: 'Safety check on player text',
    api: 'moderations',
    default: 'omni-moderation-latest',
    allowed: ['omni-moderation-latest', 'omni-moderation-2024-09-26'],
    generate: false,
  },
  extract_promises: {
    label: 'Extract promises into the bahi-khata',
    api: 'responses',
    default: 'gpt-6-luna',
    allowed: ['gpt-6-luna', 'gpt-6.1-terra', 'gpt-6.1-sol'],
    generate: true,
  },
  voice_reactions: {
    label: "Pintu's line and villagers' quotes",
    api: 'responses',
    default: 'gpt-6-luna',
    allowed: ['gpt-6-luna', 'gpt-6.1-terra'],
    generate: true,
  },
} as const;

export type TaskId = keyof typeof TASKS;
export const TASK_IDS = Object.keys(TASKS) as TaskId[];
export type Effort = 'none' | 'low' | 'medium';

export type TaskSetting = { model: string; enabled: boolean; effort: Effort };
export type Settings = { aiEnabled: boolean; tasks: Record<TaskId, TaskSetting> };

export function defaultSettings(): Settings {
  return {
    aiEnabled: true,
    tasks: Object.fromEntries(
      TASK_IDS.map((id) => [id, { model: TASKS[id].default, enabled: true, effort: 'none' }]),
    ) as Settings['tasks'],
  };
}
