import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../cubit/auth_cubit.dart';

enum _AuthFormMode { signIn, signUp }

class AuthStubPage extends StatefulWidget {
  const AuthStubPage({super.key});

  @override
  State<AuthStubPage> createState() => _AuthStubPageState();
}

class _AuthStubPageState extends State<AuthStubPage> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  _AuthFormMode _mode = _AuthFormMode.signIn;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: const Text('Sign in to MusicDNA')),
      body: SafeArea(
        child: BlocConsumer<AuthCubit, AuthState>(
          listenWhen: (previous, current) =>
              previous.submissionStatus != current.submissionStatus,
          listener: (context, state) {
            if (state.submissionStatus == AuthSubmissionStatus.failure &&
                state.errorMessage != null) {
              ScaffoldMessenger.of(
                context,
              ).showSnackBar(SnackBar(content: Text(state.errorMessage!)));
            }

            if (state.submissionStatus == AuthSubmissionStatus.success &&
                state.status == AuthStatus.authenticated) {
              context.go('/');
            }
          },
          builder: (context, state) {
            final isSubmitting =
                state.submissionStatus == AuthSubmissionStatus.submitting;

            return ListView(
              padding: const EdgeInsets.all(20),
              children: <Widget>[
                Text(
                  _mode == _AuthFormMode.signIn
                      ? 'Welcome back'
                      : 'Create your account',
                  style: theme.textTheme.headlineMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: theme.colorScheme.primary,
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  _mode == _AuthFormMode.signIn
                      ? 'Sign in with your email and password to continue your MusicDNA session.'
                      : 'We will use Supabase auth for account creation, then your opener and session flow will continue in the app.',
                  style: theme.textTheme.bodyLarge,
                ),
                const SizedBox(height: 24),
                SegmentedButton<_AuthFormMode>(
                  segments: const <ButtonSegment<_AuthFormMode>>[
                    ButtonSegment<_AuthFormMode>(
                      value: _AuthFormMode.signIn,
                      label: Text('Sign in'),
                    ),
                    ButtonSegment<_AuthFormMode>(
                      value: _AuthFormMode.signUp,
                      label: Text('Sign up'),
                    ),
                  ],
                  selected: <_AuthFormMode>{_mode},
                  onSelectionChanged: (selection) {
                    context.read<AuthCubit>().clearFeedback();
                    setState(() {
                      _mode = selection.first;
                    });
                  },
                ),
                const SizedBox(height: 24),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(20),
                    child: Form(
                      key: _formKey,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          TextFormField(
                            controller: _emailController,
                            keyboardType: TextInputType.emailAddress,
                            autofillHints: const <String>[AutofillHints.email],
                            decoration: const InputDecoration(
                              labelText: 'Email',
                            ),
                            validator: (value) {
                              final email = value?.trim() ?? '';
                              if (email.isEmpty) {
                                return 'Email is required.';
                              }
                              if (!email.contains('@')) {
                                return 'Enter a valid email address.';
                              }
                              return null;
                            },
                          ),
                          const SizedBox(height: 16),
                          TextFormField(
                            controller: _passwordController,
                            obscureText: true,
                            autofillHints: _mode == _AuthFormMode.signIn
                                ? const <String>[AutofillHints.password]
                                : const <String>[AutofillHints.newPassword],
                            decoration: const InputDecoration(
                              labelText: 'Password',
                            ),
                            validator: (value) {
                              final password = value ?? '';
                              if (password.isEmpty) {
                                return 'Password is required.';
                              }
                              if (_mode == _AuthFormMode.signUp &&
                                  password.length < 8) {
                                return 'Use at least 8 characters.';
                              }
                              return null;
                            },
                          ),
                          const SizedBox(height: 20),
                          SizedBox(
                            width: double.infinity,
                            child: FilledButton(
                              onPressed: isSubmitting ? null : _submit,
                              child: Text(
                                isSubmitting
                                    ? 'Working...'
                                    : _mode == _AuthFormMode.signIn
                                    ? 'Sign in'
                                    : 'Create account',
                              ),
                            ),
                          ),
                          if (state.errorMessage != null) ...<Widget>[
                            const SizedBox(height: 12),
                            Text(
                              state.errorMessage!,
                              style: theme.textTheme.bodyMedium?.copyWith(
                                color: theme.colorScheme.error,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                if (state.user != null)
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(20),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          Text(
                            'Current session',
                            style: theme.textTheme.titleMedium?.copyWith(
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(state.user?.email ?? state.user!.id),
                          const SizedBox(height: 12),
                          Wrap(
                            spacing: 12,
                            runSpacing: 12,
                            children: <Widget>[
                              OutlinedButton(
                                onPressed: () => context.go('/onboarding'),
                                child: const Text('Go to onboarding'),
                              ),
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
                  ),
              ],
            );
          },
        ),
      ),
    );
  }

  void _submit() {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    final authCubit = context.read<AuthCubit>();
    final email = _emailController.text.trim();
    final password = _passwordController.text;

    if (_mode == _AuthFormMode.signIn) {
      authCubit.signIn(email: email, password: password);
      return;
    }

    authCubit.signUp(email: email, password: password);
  }
}
