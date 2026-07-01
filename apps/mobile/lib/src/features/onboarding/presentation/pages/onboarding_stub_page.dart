import 'package:flutter/material.dart';

class OnboardingStubPage extends StatelessWidget {
  const OnboardingStubPage({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: const Text('Onboarding foundation')),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(
              'TGA-277 will build this flow',
              style: theme.textTheme.headlineSmall?.copyWith(
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 12),
            const Text(
              'The expected mobile signup path is now documented and ready: '
              'Supabase sign up, then POST /api/v1/onboarding/opener, then '
              'POST /api/v1/session.',
            ),
            const SizedBox(height: 20),
            const Card(
              child: Padding(
                padding: EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text('1. Collect opening three songs'),
                    SizedBox(height: 8),
                    Text('2. Commit opener analysis to the shared API'),
                    SizedBox(height: 8),
                    Text('3. Start the first MusicDNA session'),
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
