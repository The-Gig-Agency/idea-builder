import 'package:flutter/material.dart';

import '../../../onboarding/domain/entities/started_music_session.dart';

class SessionStubPage extends StatelessWidget {
  const SessionStubPage({this.startedSession, super.key});

  final StartedMusicSession? startedSession;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: const Text('Session foundation')),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(
              'TGA-278 will build the pairing loop here',
              style: theme.textTheme.headlineSmall?.copyWith(
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 12),
            const Text(
              'The mobile foundation already knows where the session loop lives. '
              'The next step is implementing repositories and state transitions '
              'for next pairing, choice submission, and reveal.',
            ),
            const SizedBox(height: 20),
            if (startedSession != null) ...<Widget>[
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text(
                        'Session handoff is working',
                        style: theme.textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 12),
                      Text('Session ID: ${startedSession!.sessionId}'),
                      const SizedBox(height: 8),
                      Text(
                        'Opener lane: ${startedSession!.analysisLane} '
                        '(${startedSession!.analysisConfidence.toStringAsFixed(2)})',
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Session lane: ${startedSession!.sessionLane} '
                        '(${startedSession!.sessionLaneConfidence.toStringAsFixed(2)})',
                      ),
                      const SizedBox(height: 8),
                      Text(startedSession!.hypothesis),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 20),
            ],
            const Card(
              child: Padding(
                padding: EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text('GET /api/v1/session/:id/next'),
                    SizedBox(height: 8),
                    Text('POST /api/v1/session/:id/choice'),
                    SizedBox(height: 8),
                    Text('POST /api/v1/session/:id/reveal'),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
