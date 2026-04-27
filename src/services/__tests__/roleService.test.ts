import { roleService } from '../roleService';
import { supabase } from '../../config/supabase';

// Mock notificationService so canEditRoles / setMemberRoles don't make push calls
jest.mock('../notificationService', () => ({
  notificationService: {
    sendPushNotification: jest.fn(() => Promise.resolve()),
  },
}));

describe('roleService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('buildUserRoleMap', () => {
    it('groups role rows by user_id', () => {
      const rows = [
        { user_id: 'u1', role_title: 'Scheduler' },
        { user_id: 'u1', role_title: 'Note Taker' },
        { user_id: 'u2', role_title: 'Role Manager' },
      ];
      const map = roleService.buildUserRoleMap(rows);
      expect(map).toEqual({
        u1: ['Scheduler', 'Note Taker'],
        u2: ['Role Manager'],
      });
    });

    it('returns an empty map for an empty array', () => {
      expect(roleService.buildUserRoleMap([])).toEqual({});
    });
  });

  describe('canEditRoles', () => {
    it('returns true for the pod creator', async () => {
      const chain: any = {
        select: jest.fn(() => chain),
        eq: jest.fn(() => chain),
        ilike: jest.fn(() => chain),
        maybeSingle: jest.fn(() => Promise.resolve({ data: null, error: null })),
        single: jest.fn(() => Promise.resolve({ data: { creator_id: 'user-alex' }, error: null })),
      };
      (supabase.from as jest.Mock).mockReturnValue(chain);

      const can = await roleService.canEditRoles('pod-1', 'user-alex');
      expect(can).toBe(true);
    });

    it('returns true when user has a Role Manager role row', async () => {
      let callCount = 0;
      const chain: any = {
        select: jest.fn(() => chain),
        eq: jest.fn(() => chain),
        ilike: jest.fn(() => chain),
        // First .single() = pursuit lookup (not creator). Second .maybeSingle() = role lookup (manager found).
        single: jest.fn(() => Promise.resolve({ data: { creator_id: 'someone-else' }, error: null })),
        maybeSingle: jest.fn(() => Promise.resolve({ data: { id: 'role-1' }, error: null })),
      };
      (supabase.from as jest.Mock).mockReturnValue(chain);

      const can = await roleService.canEditRoles('pod-1', 'user-bob');
      expect(can).toBe(true);
    });

    it('returns false for a regular member', async () => {
      const chain: any = {
        select: jest.fn(() => chain),
        eq: jest.fn(() => chain),
        ilike: jest.fn(() => chain),
        single: jest.fn(() => Promise.resolve({ data: { creator_id: 'creator' }, error: null })),
        maybeSingle: jest.fn(() => Promise.resolve({ data: null, error: null })),
      };
      (supabase.from as jest.Mock).mockReturnValue(chain);

      const can = await roleService.canEditRoles('pod-1', 'stranger');
      expect(can).toBe(false);
    });
  });

  describe('setMemberRoles (diff logic)', () => {
    it('inserts missing roles and deletes stale ones — idempotent when unchanged', async () => {
      const existing = [
        { id: 'r1', role_title: 'Scheduler' },
        { id: 'r2', role_title: 'Note Taker' },
      ];

      const calls: Record<string, number> = { insert: 0, delete: 0 };
      // Helper: first .eq() returns chain, second .eq() resolves to existing rows
      // (matches roleService's `.select(...).eq(...).eq(...)` double filter).
      let eqCalls = 0;
      const chain: any = {
        select: jest.fn(() => chain),
        eq: jest.fn(() => {
          eqCalls++;
          return eqCalls === 2 ? Promise.resolve({ data: existing, error: null }) : chain;
        }),
        insert: jest.fn(() => { calls.insert++; return Promise.resolve({ data: null, error: null }); }),
        delete: jest.fn(() => chain),
        in: jest.fn(() => { calls.delete++; return Promise.resolve({ data: null, error: null }); }),
      };
      (supabase.from as jest.Mock).mockReturnValue(chain);

      // Remove Scheduler, add Moderator. Note Taker stays.
      const result = await roleService.setMemberRoles('pod-1', 'user-1', ['Note Taker', 'Moderator']);

      expect(result).toEqual({ added: 1, removed: 1 });
      expect(calls.insert).toBe(1);
      expect(calls.delete).toBe(1);
    });

    it('no-ops when desired === existing', async () => {
      const existing = [{ id: 'r1', role_title: 'Moderator' }];
      const calls: Record<string, number> = { insert: 0, delete: 0 };
      let eqCalls = 0;
      const chain: any = {
        select: jest.fn(() => chain),
        eq: jest.fn(() => {
          eqCalls++;
          return eqCalls === 2 ? Promise.resolve({ data: existing, error: null }) : chain;
        }),
        insert: jest.fn(() => { calls.insert++; return Promise.resolve({ data: null, error: null }); }),
        delete: jest.fn(() => chain),
        in: jest.fn(() => { calls.delete++; return Promise.resolve({ data: null, error: null }); }),
      };
      (supabase.from as jest.Mock).mockReturnValue(chain);

      const result = await roleService.setMemberRoles('pod-1', 'user-1', ['Moderator']);

      expect(result).toEqual({ added: 0, removed: 0 });
      expect(calls.insert).toBe(0);
      expect(calls.delete).toBe(0);
    });

    it('deduplicates input and trims whitespace', async () => {
      const existing: any[] = [];
      let insertedRows: any[] = [];
      let eqCalls = 0;
      const chain: any = {
        select: jest.fn(() => chain),
        eq: jest.fn(() => {
          eqCalls++;
          return eqCalls === 2 ? Promise.resolve({ data: existing, error: null }) : chain;
        }),
        insert: jest.fn((rows: any[]) => { insertedRows = rows; return Promise.resolve({ data: null, error: null }); }),
        delete: jest.fn(() => chain),
        in: jest.fn(() => Promise.resolve({ data: null, error: null })),
      };
      (supabase.from as jest.Mock).mockReturnValue(chain);

      await roleService.setMemberRoles('pod-1', 'user-1', ['  Scheduler  ', 'Scheduler', '']);

      expect(insertedRows).toHaveLength(1);
      expect(insertedRows[0].role_title).toBe('Scheduler');
    });
  });
});
