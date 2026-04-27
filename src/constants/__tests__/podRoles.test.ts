import { POD_ROLES, ROLE_TITLES, ROLE_MANAGER_TITLE, SCHEDULER_TITLE, getRoleDef } from '../podRoles';

describe('podRoles catalog', () => {
  it('exports every role with a title, description, and tier', () => {
    expect(POD_ROLES.length).toBeGreaterThan(0);
    for (const role of POD_ROLES) {
      expect(typeof role.title).toBe('string');
      expect(role.title.length).toBeGreaterThan(0);
      expect(typeof role.description).toBe('string');
      expect(['core', 'optional']).toContain(role.tier);
    }
  });

  it('includes the five core roles', () => {
    const core = POD_ROLES.filter(r => r.tier === 'core').map(r => r.title);
    expect(core).toEqual(
      expect.arrayContaining(['Pod Leader', 'Scheduler', 'Note Taker', 'Moderator', 'Role Manager'])
    );
  });

  it('has no duplicate titles', () => {
    const titles = ROLE_TITLES.map(t => t.toLowerCase());
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('exposes known constants for permission checks', () => {
    expect(ROLE_MANAGER_TITLE).toBe('Role Manager');
    expect(SCHEDULER_TITLE).toBe('Scheduler');
  });

  describe('getRoleDef', () => {
    it('matches case-insensitively', () => {
      expect(getRoleDef('role manager')?.title).toBe('Role Manager');
      expect(getRoleDef('SCHEDULER')?.title).toBe('Scheduler');
    });

    it('returns undefined for unknown titles', () => {
      expect(getRoleDef('Overlord')).toBeUndefined();
    });
  });
});
