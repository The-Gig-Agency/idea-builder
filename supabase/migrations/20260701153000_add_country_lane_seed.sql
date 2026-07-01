-- Seed country lane canon and pairings

WITH country_songs AS (
  INSERT INTO public.songs (title, artist, year, lane, primary_lane, movement, atmosphere, groove, darkness, hope, nostalgia, transformation, complexity, melody, verbal_cleverness, authenticity, romanticism, energy, dreaminess, community, diagnostic_power, primary_dimensions, archetype_signals)
  VALUES
    ('I Walk the Line', 'Johnny Cash', 1956, 'country', 'country', 62, 36, 18, 68, 34, 62, 18, 42, 74, 34, 98, 22, 52, 18, 24, 95, ARRAY['confidence','melody','authenticity'], ARRAY['plainspoken_moral_force','minimal_discipline']),
    ('Your Cheatin'' Heart', 'Hank Williams', 1952, 'country', 'country', 38, 24, 12, 72, 18, 88, 10, 30, 68, 42, 99, 12, 34, 8, 18, 96, ARRAY['nostalgia','verbal_cleverness','authenticity'], ARRAY['hillbilly_lament','fatalism']),
    ('Blue Eyes Crying in the Rain', 'Willie Nelson', 1975, 'country', 'country', 34, 30, 14, 58, 22, 86, 16, 28, 70, 38, 96, 18, 30, 14, 16, 92, ARRAY['nostalgia','texture','authenticity'], ARRAY['weathered_intimacy','late_night_regret']),
    ('Turtles All the Way Down', 'Sturgill Simpson', 2014, 'country', 'country', 54, 48, 22, 54, 38, 28, 52, 74, 46, 30, 84, 24, 66, 26, 20, 90, ARRAY['transformation','complexity','texture'], ARRAY['cosmic_country','psychedelic_twist']),
    ('The Architect', 'Kacey Musgraves', 2024, 'country', 'country', 44, 62, 20, 40, 44, 22, 46, 70, 78, 28, 82, 36, 42, 34, 18, 88, ARRAY['atmosphere','verbal_cleverness','dreaminess'], ARRAY['cosmic_country','wry_observation']),
    ('You Should Probably Leave', 'Chris Stapleton', 2020, 'country', 'country', 58, 34, 18, 62, 28, 18, 22, 56, 66, 18, 88, 22, 68, 14, 20, 89, ARRAY['confidence','melody','energy'], ARRAY['southern_soul_cross','smoke_room_tension']),
    ('Need a Favor', 'Jelly Roll', 2023, 'country', 'country', 56, 40, 20, 70, 26, 20, 24, 52, 64, 20, 86, 18, 74, 16, 22, 86, ARRAY['tension','authenticity','energy'], ARRAY['redemption_story','rough_edges']),
    ('The Gambler', 'Kenny Rogers', 1978, 'country', 'country', 50, 32, 16, 44, 32, 78, 16, 34, 72, 46, 92, 20, 40, 18, 22, 90, ARRAY['verbal_cleverness','nostalgia','community'], ARRAY['story_song','moral_code'])
  RETURNING id, title, artist
),
country_pairings AS (
  INSERT INTO public.pairings (song_a_id, song_b_id, lane, tests, hypothesis, why_good, diagnostic_weight, active)
  SELECT a.id, b.id, 'country', tests, hypothesis, why_good, diagnostic_weight, true
  FROM (
    VALUES
      ('I Walk the Line', 'Your Cheatin'' Heart', ARRAY['authenticity','moral_force','melody']::text[], 'Self-command versus self-destruction.', 'Tests whether the listener trusts discipline or confession.', 96),
      ('I Walk the Line', 'The Gambler', ARRAY['confidence','verbal_cleverness','community']::text[], 'Private code versus public story-song wisdom.', 'Separates straight-backed authority from social storytelling.', 91),
      ('Your Cheatin'' Heart', 'Blue Eyes Crying in the Rain', ARRAY['nostalgia','authenticity','texture']::text[], 'Raw hurt versus weathered surrender.', 'Shows whether the listener prefers open wound or quiet ache.', 95),
      ('Blue Eyes Crying in the Rain', 'The Architect', ARRAY['dreaminess','atmosphere','verbal_cleverness']::text[], 'Dusty resignation versus cosmic reflection.', 'Tests whether country for them is plain grief or expansive thought.', 88),
      ('Turtles All the Way Down', 'The Gambler', ARRAY['complexity','story_song','transformation']::text[], 'Philosophical drift versus clean narrative frame.', 'Separates outsider-country braininess from classic country parable.', 92),
      ('Turtles All the Way Down', 'Need a Favor', ARRAY['energy','tension','authenticity']::text[], 'Spaced-out country versus scarred contemporary country.', 'Tests whether the listener wants heady weirdness or bruised urgency.', 94),
      ('You Should Probably Leave', 'Need a Favor', ARRAY['confidence','tension','energy']::text[], 'Cool refusal versus messy need.', 'For listeners who want country to smolder instead of sob.', 90),
      ('You Should Probably Leave', 'I Walk the Line', ARRAY['confidence','authenticity','melody']::text[], 'Hard moral edge versus hard romantic edge.', 'Clarifies whether the listener trusts restraint or desire.', 87),
      ('The Architect', 'Turtles All the Way Down', ARRAY['transformation','dreaminess','complexity']::text[], 'Wry modern shimmer versus psychedelic sprawl.', 'Separates polished contemporary country from heady expansiveness.', 93),
      ('The Architect', 'Blue Eyes Crying in the Rain', ARRAY['nostalgia','atmosphere','texture']::text[], 'Modern air versus old ache.', 'Tests whether they hear country as present-tense reflection or inherited sorrow.', 89),
      ('The Gambler', 'Your Cheatin'' Heart', ARRAY['verbal_cleverness','nostalgia','authenticity']::text[], 'Wry wisdom versus naked heartbreak.', 'Shows whether the listener prefers story over wound.', 90),
      ('Need a Favor', 'Blue Eyes Crying in the Rain', ARRAY['tension','texture','authenticity']::text[], 'Bruised plea versus resigned grace.', 'For listeners who want the genre to confess or console.', 89)
  ) AS p(song_a_title, song_b_title, tests, hypothesis, why_good, diagnostic_weight)
  JOIN country_songs a ON a.title = p.song_a_title
  JOIN country_songs b ON b.title = p.song_b_title
  RETURNING id
)
SELECT 1;
