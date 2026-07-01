import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../onboarding/domain/entities/started_music_session.dart';
import '../../domain/entities/session_pairing.dart';
import '../cubit/session_cubit.dart';

class SessionStubPage extends StatefulWidget {
  const SessionStubPage({super.key, this.startedSession});

  final StartedMusicSession? startedSession;

  @override
  State<SessionStubPage> createState() => _SessionStubPageState();
}

class _SessionStubPageState extends State<SessionStubPage> {
  Stopwatch? _stopwatch;
  String? _pairingId;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _syncStopwatch(
      context.read<SessionCubit>().state.currentRound?.pairing?.id,
    );
  }

  @override
  void dispose() {
    _stopwatch?.stop();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: const Text('Your session')),
      body: SafeArea(
        child: BlocConsumer<SessionCubit, SessionState>(
          listenWhen: (previous, current) =>
              previous.currentRound?.pairing?.id !=
              current.currentRound?.pairing?.id,
          listener: (context, state) {
            _syncStopwatch(state.currentRound?.pairing?.id);
          },
          builder: (context, state) {
            final round = state.currentRound;
            final pairing = round?.pairing;
            final isBusy =
                state.status == SessionStatus.loading ||
                state.status == SessionStatus.submitting;

            return ListView(
              padding: const EdgeInsets.all(20),
              children: <Widget>[
                if (widget.startedSession != null)
                  _SessionSummaryCard(session: widget.startedSession!),
                if (widget.startedSession != null) const SizedBox(height: 16),
                if (state.lastFeedback != null)
                  _FeedbackCard(feedback: state.lastFeedback!),
                if (state.lastFeedback != null) const SizedBox(height: 16),
                if (round != null &&
                    state.status != SessionStatus.missingSession)
                  _ProgressCard(round: round),
                if (round != null &&
                    state.status != SessionStatus.missingSession)
                  const SizedBox(height: 16),
                if (state.errorMessage != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 16),
                    child: Text(
                      state.errorMessage!,
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: theme.colorScheme.error,
                      ),
                    ),
                  ),
                switch (state.status) {
                  SessionStatus.initial ||
                  SessionStatus.loading => const Center(
                    child: Padding(
                      padding: EdgeInsets.symmetric(vertical: 48),
                      child: CircularProgressIndicator(),
                    ),
                  ),
                  SessionStatus.submitting => Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      if (pairing != null)
                        _PairingCard(
                          pairing: pairing,
                          isBusy: true,
                          onChoose: (_) {},
                        ),
                      const SizedBox(height: 20),
                      const Center(child: CircularProgressIndicator()),
                    ],
                  ),
                  SessionStatus.ready =>
                    pairing == null
                        ? _FallbackCard(
                            title: 'No pairing returned',
                            body:
                                'The session is active, but we did not get a pairing back yet. Try refreshing the round.',
                            primaryLabel: 'Refresh round',
                            onPrimary: () =>
                                context.read<SessionCubit>().initialize(),
                          )
                        : _PairingCard(
                            pairing: pairing,
                            isBusy: isBusy,
                            onChoose: (songId) =>
                                _chooseSong(context, chosenSongId: songId),
                          ),
                  SessionStatus.completed => _FallbackCard(
                    title: 'Session loop complete',
                    body:
                        'You made it through the current set of pairings. Reveal and share come next, but the core session loop is now working end to end.',
                    primaryLabel: 'Back to home',
                    onPrimary: () => context.go('/'),
                  ),
                  SessionStatus.failure => _FallbackCard(
                    title: 'Session hit a snag',
                    body:
                        state.errorMessage ??
                        'We could not continue the pairing loop right now.',
                    primaryLabel: 'Retry session',
                    onPrimary: () => context.read<SessionCubit>().initialize(),
                  ),
                  SessionStatus.missingSession => _FallbackCard(
                    title: 'Start from onboarding first',
                    body:
                        'We need a fresh MusicDNA session before we can serve pairings on mobile.',
                    primaryLabel: 'Go to onboarding',
                    onPrimary: () => context.go('/onboarding'),
                  ),
                },
              ],
            );
          },
        ),
      ),
    );
  }

  void _chooseSong(BuildContext context, {required String chosenSongId}) {
    final elapsedMs = _stopwatch?.elapsedMilliseconds ?? 0;
    context.read<SessionCubit>().chooseSong(
      chosenSongId: chosenSongId,
      msToDecide: elapsedMs,
    );
  }

  void _syncStopwatch(String? pairingId) {
    if (pairingId == null || pairingId == _pairingId) {
      return;
    }

    _stopwatch?.stop();
    _stopwatch = Stopwatch()..start();
    _pairingId = pairingId;
  }
}

class _SessionSummaryCard extends StatelessWidget {
  const _SessionSummaryCard({required this.session});

  final StartedMusicSession session;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(
              'Opening read',
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 8),
            Text(session.hypothesis),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: <Widget>[
                Chip(label: Text('Analysis: ${session.analysisLane}')),
                Chip(label: Text('Session: ${session.sessionLane}')),
                Chip(
                  label: Text(
                    'Confidence ${(session.sessionLaneConfidence * 100).round()}%',
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _ProgressCard extends StatelessWidget {
  const _ProgressCard({required this.round});

  final SessionRoundState round;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Wrap(
          spacing: 12,
          runSpacing: 12,
          children: <Widget>[
            Chip(label: Text('Round ${round.round}')),
            Chip(
              label: Text('Confidence ${(round.confidence * 100).round()}%'),
            ),
            if (round.pairing?.lane != null)
              Chip(label: Text('Lane ${round.pairing!.lane!}')),
          ],
        ),
      ),
    );
  }
}

class _FeedbackCard extends StatelessWidget {
  const _FeedbackCard({required this.feedback});

  final SessionChoiceFeedback feedback;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      color: theme.colorScheme.secondaryContainer.withValues(alpha: 0.7),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(
              feedback.verdict,
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 8),
            Text(feedback.why),
            if (feedback.hesitation != null && feedback.hesitation!.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text('Hesitation: ${feedback.hesitation!}'),
              ),
            if (feedback.dimension != null || feedback.delta != null)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(
                  'Signal: ${feedback.dimension ?? 'unknown'}'
                  '${feedback.delta == null ? '' : ' (${feedback.delta!.toStringAsFixed(2)})'}',
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _PairingCard extends StatelessWidget {
  const _PairingCard({
    required this.pairing,
    required this.isBusy,
    required this.onChoose,
  });

  final SessionPairing pairing;
  final bool isBusy;
  final ValueChanged<String> onChoose;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(
              pairing.hypothesis ?? 'Which one feels more like you?',
              style: theme.textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              pairing.whyGood ??
                  'Choose the song that feels more instinctively yours.',
            ),
            if (pairing.tests.isNotEmpty) ...<Widget>[
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: pairing.tests
                    .map((test) => Chip(label: Text(test)))
                    .toList(growable: false),
              ),
            ],
            const SizedBox(height: 20),
            _SongChoiceCard(
              song: pairing.songA,
              isBusy: isBusy,
              onChoose: () => onChoose(pairing.songA.id),
            ),
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 12),
              child: Center(child: Text('or')),
            ),
            _SongChoiceCard(
              song: pairing.songB,
              isBusy: isBusy,
              onChoose: () => onChoose(pairing.songB.id),
            ),
          ],
        ),
      ),
    );
  }
}

class _SongChoiceCard extends StatelessWidget {
  const _SongChoiceCard({
    required this.song,
    required this.isBusy,
    required this.onChoose,
  });

  final SessionPairingSong song;
  final bool isBusy;
  final VoidCallback onChoose;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return DecoratedBox(
      decoration: BoxDecoration(
        border: Border.all(color: theme.colorScheme.outlineVariant),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(
              song.title,
              style: theme.textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 4),
            Text(song.artist, style: theme.textTheme.titleMedium),
            if (song.year != null || song.primaryLane != null) ...<Widget>[
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: <Widget>[
                  if (song.year != null)
                    Chip(label: Text(song.year.toString())),
                  if (song.primaryLane != null)
                    Chip(label: Text(song.primaryLane!)),
                ],
              ),
            ],
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: isBusy ? null : onChoose,
                child: const Text('This is more me'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FallbackCard extends StatelessWidget {
  const _FallbackCard({
    required this.title,
    required this.body,
    required this.primaryLabel,
    required this.onPrimary,
  });

  final String title;
  final String body;
  final String primaryLabel;
  final VoidCallback onPrimary;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(
              title,
              style: theme.textTheme.headlineSmall?.copyWith(
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 8),
            Text(body),
            const SizedBox(height: 20),
            FilledButton(onPressed: onPrimary, child: Text(primaryLabel)),
          ],
        ),
      ),
    );
  }
}
