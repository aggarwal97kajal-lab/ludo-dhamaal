package com.ludodhamaal.app

import android.Manifest
import android.annotation.SuppressLint
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.os.Build
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.webkit.WebViewAssetLoader

class MainActivity : AppCompatActivity() {
    private lateinit var web: WebView
    private var pendingMic: PermissionRequest? = null
    private val micCode = 41

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        window.statusBarColor = Color.parseColor("#160D3D")
        window.navigationBarColor = Color.parseColor("#160D3D")

        web = WebView(this)
        web.setBackgroundColor(Color.parseColor("#160D3D"))
        setContentView(web)

        val loader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
            allowFileAccess = false
            setSupportZoom(false)
        }
        web.overScrollMode = View.OVER_SCROLL_NEVER
        web.addJavascriptInterface(Bridge(), "LDNative")

        web.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                loader.shouldInterceptRequest(request.url)

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val url = request.url
                if (url.host == "appassets.androidplatform.net") return false
                openOutside(url)
                return true
            }
        }

        web.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) {
                runOnUiThread {
                    val wantsMic = request.resources.contains(PermissionRequest.RESOURCE_AUDIO_CAPTURE)
                    if (!wantsMic) { request.deny(); return@runOnUiThread }
                    if (ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                        request.grant(arrayOf(PermissionRequest.RESOURCE_AUDIO_CAPTURE))
                        useLoudspeaker()
                    } else {
                        pendingMic = request
                        ActivityCompat.requestPermissions(this@MainActivity, arrayOf(Manifest.permission.RECORD_AUDIO), micCode)
                    }
                }
            }
        }

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                web.evaluateJavascript("(window.ldBack && window.ldBack()) ? 'y' : 'n'") { v ->
                    if (v == null || !v.contains("y")) finish()
                }
            }
        })

        if (savedInstanceState != null) web.restoreState(savedInstanceState)
        else web.loadUrl("https://appassets.androidplatform.net/assets/www/index.html")
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        web.saveState(outState)
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == micCode) {
            val req = pendingMic ?: return
            pendingMic = null
            if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                req.grant(arrayOf(PermissionRequest.RESOURCE_AUDIO_CAPTURE))
                useLoudspeaker()
            } else req.deny()
        }
    }

    override fun onPause() { super.onPause(); web.onPause() }
    override fun onResume() { super.onResume(); web.onResume(); useLoudspeaker() }

    // Voice chat runs in "call" mode, which plays through the small earpiece by default.
    // Send it to the loudspeaker so friends can be heard while the phone is held for the game.
    private fun useLoudspeaker() {
        try {
            val am = getSystemService(Context.AUDIO_SERVICE) as AudioManager
            am.mode = AudioManager.MODE_IN_COMMUNICATION
            if (Build.VERSION.SDK_INT >= 31) {
                val speaker = am.availableCommunicationDevices.firstOrNull { it.type == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER }
                if (speaker != null) am.setCommunicationDevice(speaker)
            } else {
                @Suppress("DEPRECATION")
                am.isSpeakerphoneOn = true
            }
        } catch (e: Exception) { /* keep default routing */ }
    }

    private fun openOutside(url: Uri) {
        try { startActivity(Intent(Intent.ACTION_VIEW, url)) } catch (e: Exception) { /* no app for it */ }
    }

    inner class Bridge {
        @JavascriptInterface
        fun speaker() { runOnUiThread { useLoudspeaker() } }

        @JavascriptInterface
        fun copy(text: String) {
            val cm = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            cm.setPrimaryClip(ClipData.newPlainText("Room code", text))
        }

        @JavascriptInterface
        fun shareWhatsApp(text: String) {
            runOnUiThread {
                val send = Intent(Intent.ACTION_SEND).apply { type = "text/plain"; putExtra(Intent.EXTRA_TEXT, text) }
                val wa = Intent(send).apply { setPackage("com.whatsapp") }
                try { startActivity(wa) } catch (e: Exception) {
                    try { startActivity(Intent.createChooser(send, "Share room code")) } catch (x: Exception) { /* ignore */ }
                }
            }
        }
    }
}
