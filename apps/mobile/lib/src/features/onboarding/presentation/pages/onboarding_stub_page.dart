import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../cubit/onboarding_cubit.dart';

class OnboardingStubPage extends StatefulWidget {
  const OnboardingStubPage({super.key});

  @override
  State<OnboardingStubPage> createState() => _OnboardingStubPageState();
}

class _OnboardingStubPageState extends State<OnboardingStubPage> {
  final _formKey = GlobalKey<FormState>();
  late final List<TextEditingController> _controllers =
      List<TextEditingController>.generate(3, (_) => TextEditingController());

  @override
  void dispose() {
    for (final controller in _controllers) {
      controller.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: const Text('Your opening three')),
      body: SafeArea(
        child: BlocConsumer<OnboardingCubit, OnboardingState>(
          listenWhen: (previous, current) =>
              previous.submissionStatus != current.submissionStatus,
          listener: (context, state) {
            if (state.submissionStatus == OnboardingSubmissionStatus.failure &&
                state.errorMessage != null) {
              ScaffoldMessenger.of(
                context,
              ).showSnackBar(SnackBar(content: Text(state.errorMessage!)));
            }

            if (state.submissionStatus == OnboardingSubmissionStatus.success &&
                state.startedSession != null) {
              context.go('/session', extra: state.startedSession);
            }
          },
          builder: (context, state) {
            final isSubmitting =
                state.submissionStatus == OnboardingSubmissionStatus.submitting;

            return ListView(
              padding: const EdgeInsets.all(20),
              children: <Widget>[
                Text(
                  'Start with three songs you love',
                  style: theme.textTheme.headlineMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: theme.colorScheme.primary,
                  ),
                ),
                const SizedBox(height: 12),
                const Text(
                  'This is the first taste sketch, not the whole reading. '
                  'Give us three songs that feel unmistakably yours.',
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
                          for (
                            var index = 0;
                            index < _controllers.length;
                            index++
                          ) ...<Widget>[
                            TextFormField(
                              controller: _controllers[index],
                              textInputAction: index == _controllers.length - 1
                                  ? TextInputAction.done
                                  : TextInputAction.next,
                              decoration: InputDecoration(
                                labelText: 'Song ${index + 1}',
                                hintText: 'Song title — Artist',
                              ),
                              validator: (value) {
                                final text = value?.trim() ?? '';
                                if (text.isEmpty) {
                                  return 'Song ${index + 1} is required.';
                                }
                                return null;
                              },
                            ),
                            if (index != _controllers.length - 1)
                              const SizedBox(height: 16),
                          ],
                          const SizedBox(height: 20),
                          SizedBox(
                            width: double.infinity,
                            child: FilledButton(
                              onPressed: isSubmitting ? null : _submit,
                              child: Text(
                                isSubmitting
                                    ? 'Building your opening read...'
                                    : 'Start my session',
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
                if (state.startedSession != null)
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(20),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          Text(
                            'Last generated opener',
                            style: theme.textTheme.titleMedium?.copyWith(
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(state.startedSession!.hypothesis),
                          const SizedBox(height: 8),
                          Text(
                            'Analysis lane: ${state.startedSession!.analysisLane} '
                            '(${state.startedSession!.analysisConfidence.toStringAsFixed(2)})',
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Session lane: ${state.startedSession!.sessionLane} '
                            '(${state.startedSession!.sessionLaneConfidence.toStringAsFixed(2)})',
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

    final songs = _controllers
        .map((controller) => controller.text.trim())
        .toList(growable: false);
    context.read<OnboardingCubit>().submitOpeningThree(songs: songs);
  }
}
