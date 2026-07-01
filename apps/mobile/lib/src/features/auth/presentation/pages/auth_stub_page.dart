import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../cubit/auth_cubit.dart';

class AuthStubPage extends StatelessWidget {
  const AuthStubPage({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: const Text('Auth foundation')),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: BlocBuilder<AuthCubit, AuthState>(
          builder: (context, state) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  'TGA-279 will land here',
                  style: theme.textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 12),
                const Text(
                  'This page will become the Supabase auth shell for sign up, '
                  'sign in, session restore, and sign out. The repository and '
                  'Cubit layers are already in place so the next ticket can '
                  'focus on product flow instead of app plumbing.',
                ),
                const SizedBox(height: 20),
                Text('Current state: ${state.status.name}'),
                if (state.user != null) ...<Widget>[
                  const SizedBox(height: 8),
                  Text('User: ${state.user!.email ?? state.user!.id}'),
                ],
              ],
            );
          },
        ),
      ),
    );
  }
}
