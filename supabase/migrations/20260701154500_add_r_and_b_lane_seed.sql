-- Seed r_and_b / soul lane canon and pairings

WITH rnb_songs AS (
  INSERT INTO public.songs (title, artist, year, lane, primary_lane, movement, atmosphere, groove, darkness, hope, nostalgia, transformation, complexity, melody, verbal_cleverness, authenticity, romanticism, energy, dreaminess, community, diagnostic_power, primary_dimensions, archetype_signals)
  VALUES
    ('What''s Going On', 'Marvin Gaye', 1971, 'r_and_b', 'r_and_b', 46, 78, 58, 42, 68, 54, 28, 52, 82, 72, 96, 44, 44, 34, 76, 98, ARRAY['community','atmosphere','verbal_cleverness'], ARRAY['collective_empathy','earth_to_cosmos']),
    ('Let''s Stay Together', 'Al Green', 1972, 'r_and_b', 'r_and_b', 40, 66, 62, 34, 74, 48, 20, 46, 84, 38, 97, 72, 38, 24, 58, 97, ARRAY['romanticism','confidence','melody'], ARRAY['intimate_devotion','effortless_sheen']),
    ('Untitled (How Does It Feel)', 'D''Angelo', 2000, 'r_and_b', 'r_and_b', 34, 74, 44, 40, 42, 36, 24, 48, 76, 26, 95, 68, 30, 18, 22, 94, ARRAY['texture','romanticism','confidence'], ARRAY['raw_vulnerability','seductive_minimalism']),
    ('Adorn', 'Miguel', 2012, 'r_and_b', 'r_and_b', 42, 62, 60, 30, 62, 30, 22, 42, 88, 34, 90, 78, 40, 18, 28, 92, ARRAY['melody','romanticism','confidence'], ARRAY['effortless_cool','hooked_sheen']),
    ('Good Days', 'SZA', 2020, 'r_and_b', 'r_and_b', 28, 82, 34, 50, 64, 26, 46, 40, 76, 44, 92, 54, 20, 52, 20, 93, ARRAY['atmosphere','dreaminess','transformation'], ARRAY['peace_seeking','pain_observing']),
    ('Cranes in the Sky', 'Solange', 2016, 'r_and_b', 'r_and_b', 24, 88, 20, 52, 48, 28, 54, 44, 62, 30, 96, 62, 18, 58, 16, 95, ARRAY['atmosphere','transformation','perspective'], ARRAY['self_interrogation','restless_control']),
    ('Thinkin Bout You', 'Frank Ocean', 2012, 'r_and_b', 'r_and_b', 32, 80, 28, 38, 58, 34, 30, 38, 70, 40, 94, 46, 18, 56, 14, 91, ARRAY['perspective','dreaminess','texture'], ARRAY['private_longing','soft_confession']),
    ('Love on Top', 'Beyoncé', 2011, 'r_and_b', 'r_and_b', 64, 52, 70, 24, 82, 20, 34, 30, 86, 24, 98, 80, 66, 22, 34, 90, ARRAY['confidence','energy','community'], ARRAY['celebration','ascending_release']),
    ('Ain''t No Mountain High Enough', 'Marvin Gaye & Tammi Terrell', 1967, 'r_and_b', 'r_and_b', 70, 60, 76, 20, 88, 18, 22, 28, 82, 28, 97, 74, 58, 42, 66, 94, ARRAY['community','energy','hope'], ARRAY['uplift','duet_kinship']),
    ('Ex-Factor', 'Lauryn Hill', 1998, 'r_and_b', 'r_and_b', 30, 72, 32, 64, 28, 42, 34, 54, 74, 68, 95, 40, 24, 28, 20, 96, ARRAY['tension','verbal_cleverness','authenticity'], ARRAY['ache','confession']),
    ('If I Ain''t Got You', 'Alicia Keys', 2004, 'r_and_b', 'r_and_b', 36, 66, 42, 46, 72, 24, 28, 34, 90, 30, 96, 68, 38, 24, 54, 93, ARRAY['romanticism','melody','confidence'], ARRAY['devotion','piano_ballad']),
    ('No Diggity', 'Blackstreet', 1996, 'r_and_b', 'r_and_b', 58, 48, 68, 28, 40, 20, 18, 24, 82, 34, 92, 46, 54, 14, 28, 90, ARRAY['confidence','energy','groove'], ARRAY['swagger','club_sheen'])
  RETURNING id, title, artist
),
rnb_pairings AS (
  INSERT INTO public.pairings (song_a_id, song_b_id, lane, tests, hypothesis, why_good, diagnostic_weight, active)
  SELECT a.id, b.id, 'r_and_b', tests, hypothesis, why_good, diagnostic_weight, true
  FROM (
    VALUES
      ('What''s Going On', 'Let''s Stay Together', ARRAY['community','romanticism','atmosphere']::text[], 'Collective empathy versus intimate devotion.', 'Tests whether the listener hears R&B as public care or private surrender.', 98),
      ('Untitled (How Does It Feel)', 'Adorn', ARRAY['texture','confidence','romanticism']::text[], 'Raw vulnerability versus effortless cool.', 'Separates stripped nerve from polished seduction.', 96),
      ('Good Days', 'Cranes in the Sky', ARRAY['atmosphere','transformation','perspective']::text[], 'Peace-seeking versus pain-observing.', 'For listeners whose R&B is really about repair.', 97),
      ('Thinkin Bout You', 'Love on Top', ARRAY['perspective','confidence','energy']::text[], 'Private longing versus public celebration.', 'Tests whether they reward inward confession or bright arrival.', 93),
      ('Prototype', 'Love on Top', ARRAY['discovery','celebration','community']::text[], 'Alien tenderness versus maximal uplift.', 'Shows whether the listener trusts weirdness or payoff.', 90),
      ('Ain''t No Mountain High Enough', 'Ex-Factor', ARRAY['hope','authenticity','community']::text[], 'Uplift versus ache.', 'Separates R&B as rescue from R&B as confession.', 91),
      ('If I Ain''t Got You', 'Fallin''', ARRAY['devotion','surrender','melody']::text[], 'Need as promise versus need as collapse.', 'Good for listeners who reveal their emotional threshold fast.', 92),
      ('Ex-Factor', 'No Diggity', ARRAY['tension','swagger','authenticity']::text[], 'Bruise versus cool.', 'Tests whether the listener prefers exposed wound or guarded charm.', 94),
      ('What''s Going On', 'Prototype', ARRAY['community','earth_to_cosmos','transformation']::text[], 'Social witness versus cosmic intimacy.', 'A strong split between outward empathy and inward bloom.', 95),
      ('Let''s Stay Together', 'If I Ain''t Got You', ARRAY['romanticism','confidence','melody']::text[], 'Steady devotion versus absolute claim.', 'Clarifies whether love means maintenance or declaration.', 89),
      ('Good Days', 'Adorn', ARRAY['peace_seeking','seduction','dreaminess']::text[], 'Healing room versus velvet lure.', 'Tests whether the listener wants space or touch.', 94),
      ('Cranes in the Sky', 'Untitled (How Does It Feel)', ARRAY['restraint','texture','vulnerability']::text[], 'Self-scrutiny versus surrender.', 'For listeners who hear R&B as emotional control or emotional exposure.', 95)
  ) AS p(song_a_title, song_b_title, tests, hypothesis, why_good, diagnostic_weight)
  JOIN rnb_songs a ON a.title = p.song_a_title
  JOIN rnb_songs b ON b.title = p.song_b_title
  RETURNING id
)
SELECT 1;
