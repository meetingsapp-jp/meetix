# ProGuard rules for MisFinanzas

# Keep all classes and members from the app package
-keep class com.misfinanzas.** { *; }

# Keep WebView classes
-keep class android.webkit.** { *; }

# Keep native methods
-keepclasseswithmembernames class * {
    native <methods>;
}

# Keep view constructors
-keepclasseswithmembers class * {
    public <init>(android.content.Context, android.util.AttributeSet);
}

# Keep all R classes
-keepclassmembers class **.R$* {
    public static <fields>;
}

# Preserve line numbers for debugging
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
