# Supabase Schema Documentation

**Complete documentation of the Whale Pod Supabase database.**
This is the source of truth for the backend - not the migration files.

## Last Updated
2025-01-19 (Migrations 043-046 applied - RLS optimizations complete)

## Quick Stats

| Metric | Count |
|--------|-------|
| Tables | 37 |
| RLS Policies | 124 |
| Indexes | 88 |
| Functions | 12 |
| Triggers | 18 |
| Storage Buckets | 3 |
| Foreign Key Relationships | 54 |
| Realtime-enabled Tables | 3 |

---

## Files in this Directory

| File | Description |
|------|-------------|
| `tables.json` | List of all 37 tables |
| `foreign-keys.json` | All foreign key relationships |
| `triggers.json` | Automatic timestamp update triggers |
| `storage.json` | Storage buckets and policies |
| `realtime.json` | Tables with realtime subscriptions |
| `extensions.json` | PostgreSQL extensions enabled |
| `function-definitions.sql` | Complete function source code |
| `check-constraints.json` | Value validation constraints |
| `functions.json` | Function metadata |

---

## Core Tables Architecture

```
                    ┌─────────────┐
                    │   profiles  │ (Users)
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌─────────────┐
        │ pursuits │ │connections│ │notifications│
        │  (Pods)  │ └──────────┘ └─────────────┘
        └────┬─────┘
             │
    ┌────────┼────────┬─────────────┐
    │        │        │             │
    ▼        ▼        ▼             ▼
┌────────┐┌────────┐┌─────────┐┌──────────────────┐
│meetings││team_   ││pursuit_ ││ pod_chat_messages│
│        ││members ││applicat-││ pod_meeting_*    │
│        ││        ││ions     ││ pod_docs/rules   │
└────────┘└────────┘└─────────┘└──────────────────┘
```

---

## Known Issues

### ✅ RESOLVED - All RLS & Performance Issues (Migrations 043-046 - 2025-01-19)

**Started with 184 advisor issues → Now 10 intentional warnings**

1. ~~**Duplicate policies** causing overhead~~ - **FIXED** (043, 046)
   - All duplicate policies consolidated across all tables

2. ~~**Performance issue**: Most policies use `auth.uid()` directly~~ - **FIXED** (043)
   - All policies now use `(select auth.uid())` for single evaluation per query

3. ~~**Function search_path security warnings**~~ - **FIXED** (044)
   - All functions now have `SET search_path = public`

4. ~~**Missing foreign key indexes**~~ - **FIXED** (045)
   - Added 27 indexes for unindexed foreign keys

5. **Intentionally permissive policies** (by design - 10 warnings expected):
   - SELECT policies use `USING (true)` for public read access
   - `notifications` INSERT uses `WITH CHECK (true)` - required for system notifications
   - `kick_proposals`, `votes`, `time_slot_proposals`, `kickoff_meetings` use permissive INSERT/UPDATE - required for voting/proposal systems

### 🟠 Storage Issues

1. **Resumes publicly readable**: Any authenticated user can read any resume
2. **Duplicate storage policies**: profile-pictures has duplicate SELECT, INSERT, UPDATE policies

### 🟡 Function Issues

1. **`can_view_profile_section()`**:
   - Originally referenced wrong column names for connections table
   - References 'applications' instead of 'pursuit_applications' in one place

### 🔵 Missing Realtime

These tables should have realtime but don't:
- `messages` (direct messages - currently uses 3-second polling)
- `pod_chat_messages` (pod chat - currently uses 3-second polling)
- `meetings` (meeting updates)
- `team_members` (member joins/leaves)

---

## Table Categories

### User Management
- `profiles` - User profiles (extends auth.users)
- `privacy_preferences` - User privacy settings
- `connections` - Friend connections between users
- `push_tokens` - Push notification tokens

### Pods (Pursuits)
- `pursuits` - Main pods/groups table
- `team_members` - Pod membership
- `member_roles` - Roles within pods
- `pursuit_applications` - Applications to join pods

### Meetings & Scheduling
- `meetings` - Scheduled meetings
- `meeting_participants` - Meeting attendees
- `meeting_agenda_items` - Meeting agendas
- `meeting_contributions` - Meeting content
- `meeting_notes` - Meeting notes
- `kickoff_meetings` - Initial pod meetings
- `kickoff_time_proposals` - Time proposal for kickoff
- `time_slot_proposals` - Generic time proposals

### Pod Workspace
- `pod_meeting_pages` - Meeting page container
- `pod_meeting_agenda_items` - Pod-specific agenda
- `pod_meeting_materials` - Meeting materials
- `pod_meeting_notes` - Pod meeting notes
- `pod_meeting_recap_items` - Meeting recaps
- `pod_docs` - Pod documents
- `pod_rules` - Pod rules
- `pod_agenda_documents` - Rich text agendas

### Chat & Messaging
- `messages` - Direct messages
- `pod_chat_messages` - Pod group chat
- `pod_chat_read_status` - Read receipts for pod chat
- `pod_chat_settings` - Pod chat configuration
- `notifications` - In-app notifications

### Media & Content
- `shared_media` - Shared files in pods
- `team_gallery` - Pod photo gallery
- `team_boards` - Kanban boards
- `board_tasks` - Board tasks

### Reviews & Voting
- `reviews` - User reviews
- `votes` - Pod voting system
- `kick_proposals` - Proposals to remove members

### Integrations
- `user_notion_connections` - Notion integration

---

## Indexes Summary

Well-indexed tables:
- `pursuits` (8 indexes)
- `meetings` (5 indexes)
- `notifications` (5 indexes)
- `reviews` (6 indexes)
- `team_members` (4 indexes)

Tables that may need more indexes:
- `pod_chat_messages` - missing `sender_id` index
- `pod_agenda_documents` - only has `pod_id` unique index

---

## Realtime Configuration

Currently enabled:
1. `notifications` - For popup notifications
2. `pursuit_applications` - For application status updates
3. `push_tokens` - For token management

Should be enabled:
1. `messages` - Replace 3-second polling
2. `pod_chat_messages` - Replace 3-second polling

---

## Updating This Documentation

When making database changes:

1. Run the diagnostic queries from the parent README
2. Update the relevant JSON files
3. Update this README if schema changes significantly

```sql
-- Quick check of current state
SELECT COUNT(*) as policies FROM pg_policies WHERE schemaname = 'public';
SELECT COUNT(*) as tables FROM information_schema.tables WHERE table_schema = 'public';
SELECT COUNT(*) as functions FROM information_schema.routines WHERE routine_schema = 'public';
```
