-- ============================================================
-- 089: 50 demo users + a few populated pods.
--
-- For App Review and screenshots. An empty app invites "we were unable to
-- evaluate the functionality" and makes every screenshot look broken.
--
-- READ THIS BEFORE RUNNING IN PRODUCTION
--
-- Demo users are indistinguishable from real ones to a real user. Someone's
-- first action being an application to a pod that will never respond is the
-- worst possible introduction to an app whose entire premise is that a real
-- person shows up. Seed for review and screenshots; decide separately whether
-- these should exist once real people arrive. Teardown is at the bottom and is
-- a single statement.
--
-- THREE DELIBERATE SAFETY PROPERTIES
--
--   1. Every seeded account's email ends in `@demo.whalepod.local`, a reserved
--      TLD that can never be a real address. That single marker is what makes
--      teardown safe: it cannot match a real user no matter what else is in
--      the table.
--
--   2. The accounts CANNOT BE LOGGED INTO. encrypted_password is set to a
--      fixed string that is not a valid bcrypt hash, so password verification
--      always fails. Fifty accounts with a known password would be fifty ways
--      into your database.
--
--   3. profile_picture is left NULL on purpose, so the app renders its
--      initial-letter avatars. Stock or scraped photos of real faces are both
--      a licensing problem and an App Store problem, and AI faces in a social
--      app read as fake the moment anyone looks twice.
--
-- Idempotent: re-running inserts nothing new.
-- ============================================================

DO $$
DECLARE
  first_names text[] := ARRAY[
    'Maya','Jordan','Priya','Elliot','Nina','Marcus','Thea','Devon','Ingrid','Omar',
    'Celeste','Rafael','Juno','Hassan','Lena','Theo','Sora','Amara','Felix','Noor',
    'Dashiell','Imani','Caspar','Yuki','Rosalind','Idris','Beatrix','Mateo','Saoirse','Kwame',
    'Freya','Dmitri','Anjali','Soren','Odette','Tobias','Leila','Hugo','Marisol','Ezra',
    'Wren','Kofi','Sylvie','Anton','Delphine','Rohan','Cosima','Levi','Greta','Malik'
  ];
  last_names text[] := ARRAY[
    'Okafor','Reyes','Lindqvist','Bhatt','Moreau','Sinclair','Adeyemi','Novak','Castellanos','Haddad',
    'Whitfield','Kowalski','Oyelaran','Marchetti','Dubois','Ferreira','Nakamura','Mbeki','Ashworth','Rahimi',
    'Thorne','Washington','Lindgren','Sato','Carrington','Bello','Fairweather','Delgado','Brennan','Mensah',
    'Halvorsen','Volkov','Chaudhary','Eriksen','Lapointe','Hartmann','Nasser','Berger','Vega','Stern',
    'Ashby','Boateng','Rousseau','Petrov','Garnier','Kapoor','Albertini','Rosen','Lindholm','Diallo'
  ];
  colleges text[] := ARRAY[
    'UNC Chapel Hill','NC State','Duke','Wake Forest','App State','Elon','Davidson','UNC Charlotte'
  ];
  works text[] := ARRAY[
    'Product designer','Backend engineer','Physical therapist','Teacher','Nurse','Carpenter',
    'Data analyst','Chef','Architect','Paralegal','Bike mechanic','Copywriter'
  ];
  bios text[] := ARRAY[
    'Better at the 5am version of a plan than the 9pm one.',
    'Trying to finish things I start. Mixed results so far.',
    'Here for accountability, staying for the people.',
    'Will absolutely bring snacks.',
    'Slow runner, consistent showing up.',
    'Two years of half-finished projects. Fixing that.',
    'Prefers a standing weekly over a group chat.',
    'New to the area, looking for people to build with.'
  ];
  interest_pool text[] := ARRAY[
    'running','woodworking','cold plunges','sourdough','climbing','chess','pottery',
    'cycling','language learning','film photography','gardening','weightlifting'
  ];
  pod_type_pool text[] := ARRAY['fitness','creative','business','learning','social'];

  i          int;
  uid        uuid;
  demo_email text;
  fname      text;
  lname      text;
  created    int := 0;
BEGIN
  FOR i IN 1..50 LOOP
    fname := first_names[i];
    lname := last_names[i];
    demo_email := lower(fname) || '.' || lower(lname) || '@demo.whalepod.local';

    -- Skip if this demo account already exists (makes the file re-runnable).
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = demo_email) THEN
      CONTINUE;
    END IF;

    uid := gen_random_uuid();

    INSERT INTO auth.users (
      id, instance_id, aud, role, email,
      encrypted_password,          -- intentionally not a valid hash: see header
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data
    ) VALUES (
      uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', demo_email,
      'DEMO-ACCOUNT-NO-LOGIN',
      now() - (i || ' days')::interval,
      now() - (i || ' days')::interval,
      now(),
      '{"provider":"email","providers":["email"],"demo":true}'::jsonb,
      jsonb_build_object('demo', true, 'name', fname || ' ' || lname)
    );

    -- handle_new_user may have created a bare profile row via trigger; fill it
    -- in either way rather than assuming which happened.
    INSERT INTO public.profiles (id, name, email, created_at)
    VALUES (uid, fname || ' ' || lname, demo_email, now() - (i || ' days')::interval)
    ON CONFLICT (id) DO NOTHING;

    UPDATE public.profiles SET
      name                = fname || ' ' || lname,
      username            = lower(fname) || lower(substr(lname, 1, 1)) || (100 + i)::text,
      bio                 = bios[1 + (i % array_length(bios, 1))],
      college             = colleges[1 + (i % array_length(colleges, 1))],
      work                = works[1 + (i % array_length(works, 1))],
      age                 = 22 + (i % 18),
      interests           = ARRAY[
                              interest_pool[1 + (i % array_length(interest_pool, 1))],
                              interest_pool[1 + ((i + 4) % array_length(interest_pool, 1))]
                            ],
      pod_types           = ARRAY[pod_type_pool[1 + (i % array_length(pod_type_pool, 1))]],
      profile_picture     = NULL,    -- initial-letter avatar; see header
      application_status  = 'approved',
      onboarding_completed = true,
      updated_at          = now()
    WHERE id = uid;

    created := created + 1;
  END LOOP;

  RAISE NOTICE '089: created % demo users', created;
END $$;

-- ------------------------------------------------------------
-- A few pods so the feed isn't empty, each led by a demo user with other
-- demo users as members. Guarded on title so re-running is a no-op.
-- ------------------------------------------------------------
DO $$
DECLARE
  demo_ids uuid[];
  pod_id   uuid;
  seeds    jsonb := jsonb_build_array(
    jsonb_build_object('title','Half Marathon by Spring','desc','Training for the Tobacco Road half. Long runs Saturdays, easy miles midweek, shared log so nobody quietly drops off.','cadence','Tue & Thu mornings','loc','Chapel Hill, NC','max',5,'members',3),
    jsonb_build_object('title','Ship a SaaS in 90 Days','desc','Four builders, one deadline. Weekly demos, honest feedback, no vanity metrics.','cadence','Sundays, 7pm','loc','Remote','max',4,'members',2),
    jsonb_build_object('title','Learn Portuguese Together','desc','Conversational practice twice a week. Absolute beginners welcome, we are all bad at this.','cadence','Mon & Wed evenings','loc','Durham, NC','max',6,'members',4),
    jsonb_build_object('title','Sunrise Swim Club','desc','Open water when it is warm, pool when it is not. 6am, no negotiating.','cadence','Weekday mornings','loc','Raleigh, NC','max',8,'members',5),
    jsonb_build_object('title','Finish the Novel','desc','1,000 words a week and we read each other''s pages. Gentle but we do expect the pages.','cadence','Thursdays','loc','Remote','max',4,'members',3)
  );
  seed     jsonb;
  idx      int := 1;
  m        int;
BEGIN
  SELECT array_agg(id ORDER BY created_at)
    INTO demo_ids
    FROM public.profiles
   WHERE email LIKE '%@demo.whalepod.local';

  IF demo_ids IS NULL OR array_length(demo_ids, 1) < 10 THEN
    RAISE NOTICE '089: not enough demo users to seed pods, skipping';
    RETURN;
  END IF;

  FOR seed IN SELECT * FROM jsonb_array_elements(seeds) LOOP
    IF EXISTS (SELECT 1 FROM public.pursuits WHERE title = seed->>'title') THEN
      idx := idx + 8;
      CONTINUE;
    END IF;

    INSERT INTO public.pursuits (
      creator_id, title, description, meeting_cadence, location,
      team_size_max, current_members_count, status, created_at
    ) VALUES (
      demo_ids[idx],
      seed->>'title',
      seed->>'desc',
      seed->>'cadence',
      seed->>'loc',
      (seed->>'max')::int,
      (seed->>'members')::int,
      'active',
      now() - ((idx % 20) || ' days')::interval
    ) RETURNING id INTO pod_id;

    -- creator counts as a member, then fill to the stated count
    INSERT INTO public.team_members (pursuit_id, user_id, status, created_at)
    VALUES (pod_id, demo_ids[idx], 'active', now() - ((idx % 20) || ' days')::interval)
    ON CONFLICT (pursuit_id, user_id) DO NOTHING;

    FOR m IN 1..((seed->>'members')::int - 1) LOOP
      INSERT INTO public.team_members (pursuit_id, user_id, status, created_at)
      VALUES (pod_id, demo_ids[idx + m], 'active', now() - ((idx % 15) || ' days')::interval)
      ON CONFLICT (pursuit_id, user_id) DO NOTHING;
    END LOOP;

    idx := idx + 8;
  END LOOP;

  RAISE NOTICE '089: demo pods seeded';
END $$;

-- ============================================================
-- VERIFY
-- ============================================================
-- SELECT count(*) AS demo_users FROM profiles WHERE email LIKE '%@demo.whalepod.local';
-- -- expect: 50
--
-- SELECT title, current_members_count, status FROM pursuits
--  WHERE creator_id IN (SELECT id FROM profiles WHERE email LIKE '%@demo.whalepod.local');
-- -- expect: 5 pods
--
-- -- None of them can be logged into:
-- SELECT count(*) AS loginable FROM auth.users
--  WHERE email LIKE '%@demo.whalepod.local'
--    AND encrypted_password <> 'DEMO-ACCOUNT-NO-LOGIN';
-- -- expect: 0
--
-- -- Your real account is untouched:
-- SELECT count(*) AS real_users FROM auth.users WHERE email NOT LIKE '%@demo.whalepod.local';
-- -- expect: however many real users you had, unchanged

-- ============================================================
-- TEARDOWN — remove every trace of the demo data.
--
-- Safe because the predicate can only ever match the reserved demo domain.
-- The auth.users delete cascades to profiles, pursuits they created,
-- team_members, messages, applications and notifications.
-- ============================================================
-- DELETE FROM auth.users WHERE email LIKE '%@demo.whalepod.local';
--
-- -- Then confirm nothing is left:
-- -- SELECT count(*) FROM profiles WHERE email LIKE '%@demo.whalepod.local';  -- 0
