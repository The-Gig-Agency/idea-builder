import 'package:equatable/equatable.dart';

class AuthUser extends Equatable {
  const AuthUser({required this.id, this.email});

  final String id;
  final String? email;

  @override
  List<Object?> get props => <Object?>[id, email];
}
