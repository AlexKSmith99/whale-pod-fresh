// Pod role catalog. Default roles live here so new roles can be added
// without touching the database.

export interface PodRoleDef {
  title: string;
  description: string;
  tier: 'core' | 'optional';
}

export const POD_ROLES: PodRoleDef[] = [
  // Core
  { title: 'Pod Leader',        tier: 'core',     description: 'Drives the pod’s direction and keeps momentum.' },
  { title: 'Scheduler',         tier: 'core',     description: 'Sets up meetings and manages the pod calendar.' },
  { title: 'Note Taker',        tier: 'core',     description: 'Captures notes, decisions, and action items.' },
  { title: 'Moderator',         tier: 'core',     description: 'Guides discussion and keeps conversations on track.' },
  { title: 'Role Manager',      tier: 'core',     description: 'Assigns and reviews pod member roles.' },
  // Optional
  { title: 'Engagement Manager', tier: 'optional', description: 'Watches participation and pulls members back in.' },
  { title: 'Project Manager',    tier: 'optional', description: 'Tracks tasks, deliverables, and deadlines.' },
  { title: 'Tech Lead',          tier: 'optional', description: 'Owns technical decisions and review.' },
  { title: 'Marketing',          tier: 'optional', description: 'Handles outreach and external comms.' },
];

// Lookup helpers
export const ROLE_TITLES = POD_ROLES.map(r => r.title);

export const ROLE_MANAGER_TITLE = 'Role Manager';
export const SCHEDULER_TITLE = 'Scheduler';

export const getRoleDef = (title: string): PodRoleDef | undefined =>
  POD_ROLES.find(r => r.title.toLowerCase() === title.toLowerCase());
