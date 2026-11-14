# Capacitor & BOARDORA ProGuard / R8 release keep rules
-keepattributes *Annotation*,SourceFile,LineNumberTable
-keep class com.boardora.teninone.** { *; }
-keep class com.getcapacitor.** { *; }
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keepclassmembers class * extends com.getcapacitor.Plugin {
    @com.getcapacitor.PluginMethod <methods>;
}
