package dev.rdlabo.capacitor.nativeui

import android.content.Context
import android.content.res.Configuration
import android.os.Build
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.ui.graphics.toArgb
import com.getcapacitor.JSObject
import java.util.Locale

internal object DynamicColorScheme {
    fun read(context: Context): JSObject {
        val dark = (context.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
        val result = JSObject().put("available", Build.VERSION.SDK_INT >= Build.VERSION_CODES.S).put("systemDark", dark)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            result.put("light", roles(dynamicLightColorScheme(context)))
            result.put("dark", roles(dynamicDarkColorScheme(context)))
        }
        return result
    }

    private fun roles(scheme: ColorScheme): JSObject {
        val result = JSObject()
        mapOf(
            "primary" to scheme.primary,
            "secondary" to scheme.secondary,
            "tertiary" to scheme.tertiary,
            "error" to scheme.error,
            "surface" to scheme.surface,
            "onSurface" to scheme.onSurface,
        ).forEach { (role, color) ->
            result.put(role, String.format(Locale.ROOT, "#%06x", color.toArgb() and 0xffffff))
        }
        return result
    }
}
