import 'package:flutter/material.dart';

class AppTheme {
  static ThemeData light() {
    const ivory = Color(0xFFF8F3E8);
    const ink = Color(0xFF17324D);
    const coral = Color(0xFFE56A5D);
    const mist = Color(0xFFDCE7F5);

    final colorScheme = ColorScheme.fromSeed(
      seedColor: coral,
      brightness: Brightness.light,
      primary: ink,
      secondary: coral,
      surface: ivory,
    );

    return ThemeData(
      useMaterial3: true,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: ivory,
      appBarTheme: const AppBarTheme(
        backgroundColor: ivory,
        foregroundColor: ink,
        centerTitle: false,
      ),
      cardTheme: CardThemeData(
        color: Colors.white,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(24),
          side: const BorderSide(color: mist),
        ),
      ),
      chipTheme: const ChipThemeData(
        shape: StadiumBorder(),
        side: BorderSide.none,
      ),
    );
  }
}
