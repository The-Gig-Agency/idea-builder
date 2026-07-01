-- Seed metal lane canon and pairings

WITH metal_songs AS (
  INSERT INTO public.songs (title, artist, year, lane, primary_lane, movement, atmosphere, groove, darkness, hope, nostalgia, transformation, complexity, melody, verbal_cleverness, authenticity, romanticism, energy, dreaminess, community, diagnostic_power, primary_dimensions, archetype_signals)
  VALUES
    ('Paranoid', 'Black Sabbath', 1970, 'metal', 'metal', 82, 28, 22, 86, 20, 34, 18, 58, 64, 24, 92, 18, 88, 18, 24, 94, ARRAY['tension','energy','confidence'], ARRAY['riff_discipline','doom_weight']),
    ('Master of Puppets', 'Metallica', 1986, 'metal', 'metal', 84, 24, 18, 88, 16, 22, 20, 84, 52, 20, 91, 14, 96, 12, 18, 96, ARRAY['tension','complexity','energy'], ARRAY['precision_thrash','riff_control']),
    ('The Number of the Beast', 'Iron Maiden', 1982, 'metal', 'metal', 78, 30, 24, 80, 22, 30, 24, 72, 68, 22, 90, 16, 90, 18, 26, 92, ARRAY['movement','tension','melody'], ARRAY['epic_pacing','dual_guitar']),
    ('Raining Blood', 'Slayer', 1986, 'metal', 'metal', 94, 18, 12, 96, 8, 18, 10, 78, 34, 12, 96, 8, 98, 6, 14, 97, ARRAY['tension','energy','confidence'], ARRAY['thrash_attack','brutality']),
    ('Schism', 'Tool', 2001, 'metal', 'metal', 70, 46, 20, 74, 26, 18, 72, 92, 48, 26, 88, 20, 74, 18, 20, 95, ARRAY['complexity','transformation','immersion'], ARRAY['prog_metal','polyrhythm']),
    ('Blood and Thunder', 'Mastodon', 2004, 'metal', 'metal', 76, 38, 28, 82, 18, 16, 34, 76, 44, 20, 90, 14, 94, 12, 18, 90, ARRAY['movement','tension','energy'], ARRAY['sludge_progsurge','cathedral_weight']),
    ('My Own Summer (Shove It)', 'Deftones', 1997, 'metal', 'metal', 68, 54, 30, 76, 24, 20, 36, 62, 60, 18, 88, 22, 82, 24, 20, 88, ARRAY['atmosphere','energy','texture'], ARRAY['nu_metal','heavy_air']),
    ('Blind', 'Korn', 1994, 'metal', 'metal', 72, 42, 24, 78, 20, 18, 28, 58, 40, 16, 86, 12, 86, 10, 18, 87, ARRAY['tension','texture','energy'], ARRAY['nu_metal','groove_crush']),
    ('Toxic Garbage Island', 'Gojira', 2006, 'metal', 'metal', 80, 40, 18, 84, 18, 12, 38, 88, 38, 18, 92, 10, 92, 14, 16, 94, ARRAY['complexity','tension','transformation'], ARRAY['technical_death','precision_weight']),
    ('Walk', 'Pantera', 1992, 'metal', 'metal', 86, 20, 18, 90, 14, 14, 18, 64, 36, 12, 94, 10, 96, 8, 16, 93, ARRAY['confidence','energy','tension'], ARRAY['groove_metal','command'])
  RETURNING id, title, artist
),
metal_pairings AS (
  INSERT INTO public.pairings (song_a_id, song_b_id, lane, tests, hypothesis, why_good, diagnostic_weight, active)
  SELECT a.id, b.id, 'metal', tests, hypothesis, why_good, diagnostic_weight, true
  FROM (
    VALUES
      ('Paranoid', 'Master of Puppets', ARRAY['brutality','precision','riff_density']::text[], 'Old-school doom bite versus modern thrash architecture.', 'Tests whether the listener rewards weight and menace, or control and mechanical force.', 97),
      ('Paranoid', 'The Number of the Beast', ARRAY['melody','danger','anthemic_force']::text[], 'Hooks that still feel dangerous versus hooks that feel immortal.', 'Separates melody-first metal from riff-first metal.', 92),
      ('Master of Puppets', 'Raining Blood', ARRAY['brutality','technicality','release']::text[], 'Tight, disciplined punishment versus pure velocity.', 'Shows whether the listener prefers composure under pressure or total rupture.', 98),
      ('The Number of the Beast', 'Walk', ARRAY['confidence','melody','command']::text[], 'Epic theatrical command versus blunt groove authority.', 'Tests whether metal for them is grandeur or swagger.', 90),
      ('Schism', 'Toxic Garbage Island', ARRAY['complexity','transformation','immersion']::text[], 'Mathy structure versus technical density.', 'For listeners who reward architecture more than attack.', 95),
      ('Schism', 'My Own Summer (Shove It)', ARRAY['texture','immersion','release']::text[], 'Alien air and controlled unease versus immediate physical impact.', 'Separates atmosphere-metal from punchy crossover metal.', 91),
      ('Blood and Thunder', 'Walk', ARRAY['energy','confidence','groove']::text[], 'Cathedral-size surge versus chest-out groove.', 'Clarifies whether the listener wants forward propulsion or grounded stomp.', 93),
      ('Blind', 'My Own Summer (Shove It)', ARRAY['texture','energy','tension']::text[], 'Raw nerve versus polished pressure.', 'Tests what kind of heaviness they trust when the room gets ugly.', 89),
      ('Toxic Garbage Island', 'Master of Puppets', ARRAY['complexity','precision','release']::text[], 'Technical labyrinth versus surgical thrash.', 'Shows whether precision matters more than speed.', 94),
      ('Raining Blood', 'Blood and Thunder', ARRAY['brutality','movement','danger']::text[], 'Pure attack versus epic crush.', 'For listeners who think heaviness should either sprint or avalanche.', 96),
      ('Paranoid', 'Blind', ARRAY['groove','riff_discipline','command']::text[], 'Sabbath swing versus nu-metal pound.', 'Separates classic metal weight from modern low-end force.', 88),
      ('The Number of the Beast', 'Schism', ARRAY['melody','complexity','transformation']::text[], 'Singable menace versus shape-shifting structure.', 'Tests whether the listener wants the song to stay a song or mutate in front of them.', 90)
  ) AS p(song_a_title, song_b_title, tests, hypothesis, why_good, diagnostic_weight)
  JOIN metal_songs a ON a.title = p.song_a_title
  JOIN metal_songs b ON b.title = p.song_b_title
  RETURNING id
)
SELECT 1;
