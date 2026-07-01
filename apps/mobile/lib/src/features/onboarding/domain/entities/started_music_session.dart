import 'package:equatable/equatable.dart';

class StartedMusicSession extends Equatable {
  const StartedMusicSession({
    required this.sessionId,
    required this.sessionLane,
    required this.sessionLaneConfidence,
    required this.analysisLane,
    required this.analysisConfidence,
    required this.hypothesis,
    required this.reaction,
    required this.reasoning,
    required this.secondaryLanes,
    required this.songs,
  });

  final String sessionId;
  final String sessionLane;
  final double sessionLaneConfidence;
  final String analysisLane;
  final double analysisConfidence;
  final String hypothesis;
  final String reaction;
  final List<String> reasoning;
  final List<String> secondaryLanes;
  final List<String> songs;

  @override
  List<Object?> get props => <Object?>[
    sessionId,
    sessionLane,
    sessionLaneConfidence,
    analysisLane,
    analysisConfidence,
    hypothesis,
    reaction,
    reasoning,
    secondaryLanes,
    songs,
  ];
}
