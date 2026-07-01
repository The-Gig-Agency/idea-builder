import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/config/app_config.dart';
import '../../../../features/auth/presentation/cubit/auth_cubit.dart';

class FoundationHomePage extends StatelessWidget {
  const FoundationHomePage({required this.config, super.key});

  final AppConfig config;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: Text(config.appName)),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: <Widget>[
          Text(
            'Mobile foundation is ready',
            style: theme.textTheme.headlineMedium?.copyWith(
              color: theme.colorScheme.primary,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            'This scaffold wires compile-time config, Supabase bootstrap, '
            'a shared MusicDNA API client, and the first app architecture '
            'layers for auth, onboarding, and session flows.',
            style: theme.textTheme.bodyLarge,
          ),
          const SizedBox(height: 20),
          Wrap(
            spacing: 12,
            runSpacing: 12,
            children: <Widget>[
              Chip(label: Text('env: ${config.environment}')),
              Chip(
                label: Text(
                  config.isProduction ? 'prod-ready config' : 'non-prod config',
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          BlocBuilder<AuthCubit, AuthState>(
            builder: (context, state) {
              final signedIn = state.status == AuthStatus.authenticated;
              return Card(
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text(
                        'Current auth status',
                        style: theme.textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        signedIn
                            ? 'Signed in as ${state.user?.email ?? state.user?.id ?? 'unknown user'}'
                            : 'No active session yet.',
                      ),
                      const SizedBox(height: 12),
                      Wrap(
                        spacing: 12,
                        runSpacing: 12,
                        children: <Widget>[
                          FilledButton.tonal(
                            onPressed: () => context.go('/auth'),
                            child: Text(
                              signedIn
                                  ? 'Manage account'
                                  : 'Sign in or sign up',
                            ),
                          ),
                          if (signedIn)
                            OutlinedButton(
                              onPressed: () =>
                                  context.read<AuthCubit>().signOut(),
                              child: const Text('Sign out'),
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
          const SizedBox(height: 16),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    'Next feature landing zones',
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 12,
                    runSpacing: 12,
                    children: <Widget>[
                      FilledButton.tonal(
                        onPressed: () => context.go('/auth'),
                        child: const Text('Auth shell'),
                      ),
                      FilledButton.tonal(
                        onPressed: () => context.go('/onboarding'),
                        child: const Text('Onboarding shell'),
                      ),
                      FilledButton.tonal(
                        onPressed: () => context.go('/session'),
                        child: const Text('Session shell'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    'Shared API baseline',
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 12),
                  const Text('POST /api/v1/onboarding/opener'),
                  const Text('POST /api/v1/session'),
                  const Text('GET /api/v1/session/:id/next'),
                  const Text('POST /api/v1/session/:id/choice'),
                  const Text('POST /api/v1/session/:id/reveal'),
                  const Text('GET /api/v1/share/:token'),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
