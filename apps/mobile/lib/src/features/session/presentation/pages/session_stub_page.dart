import 'package:flutter/material.dart';

class SessionStubPage extends StatelessWidget {
  const SessionStubPage({super.key});

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
