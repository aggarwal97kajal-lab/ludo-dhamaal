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
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.media.ExifInterface
import android.util.Base64
import java.io.ByteArrayOutputStream
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.webkit.WebViewAssetLoader

class MainActivity : AppCompatActivity() {
    private lateinit var web: WebView
    private var pendingMic: PermissionRequest? = null
    private val micCode = 41
    private var pendingRoom: String? = null

    // ---------- Profile photo (stays on this phone; the game keeps it in its own storage) ----------
    private val takePhoto = registerForActivityResult(ActivityResultContracts.TakePicturePreview()) { bmp ->
        if (bmp != null) sendPhoto(bmp) else photoDone(null)
    }
    private val galleryPick = registerForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri == null) { photoDone(null); return@registerForActivityResult }
        Thread {
            val bmp = try { loadScaled(uri) } catch (e: Exception) { null }
            runOnUiThread { if (bmp != null) sendPhoto(bmp) else photoDone(null) }
        }.start()
    }

    // Reads a picture from the gallery at a small size, turned the right way up.
    private fun loadScaled(uri: Uri): Bitmap? {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, bounds) }
        var sample = 1
        while (bounds.outWidth / (sample * 2) >= 512 && bounds.outHeight / (sample * 2) >= 512) sample *= 2
        val bmp = contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, BitmapFactory.Options().apply { inSampleSize = sample }) } ?: return null
        val rot = try {
            contentResolver.openInputStream(uri)?.use {
                when (ExifInterface(it).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)) {
                    ExifInterface.ORIENTATION_ROTATE_90 -> 90f
                    ExifInterface.ORIENTATION_ROTATE_180 -> 180f
                    ExifInterface.ORIENTATION_ROTATE_270 -> 270f
                    else -> 0f
                }
            } ?: 0f
        } catch (e: Exception) { 0f }
        if (rot == 0f) return bmp
        return Bitmap.createBitmap(bmp, 0, 0, bmp.width, bmp.height, Matrix().apply { postRotate(rot) }, true)
    }

    // Cuts a square from the middle, makes it 256 x 256 and gives it to the game.
    private fun sendPhoto(src: Bitmap) {
        try {
            val side = minOf(src.width, src.height)
            val sq = Bitmap.createBitmap(src, (src.width - side) / 2, (src.height - side) / 2, side, side)
            val small = Bitmap.createScaledBitmap(sq, 256, 256, true)
            val out = ByteArrayOutputStream()
            small.compress(Bitmap.CompressFormat.JPEG, 82, out)
            photoDone("data:image/jpeg;base64," + Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP))
        } catch (e: Exception) { photoDone(null) }
    }

    private fun photoDone(data: String?) {
        val arg = if (data == null) "null" else "'" + data + "'"
        web.evaluateJavascript("window.ldPhoto && window.ldPhoto($arg)", null)
    }

    // Room code from a link like .../r/ABCDE or pitara://room/ABCDE
    private fun roomFrom(intent: Intent?): String? {
        val d = intent?.data ?: return null
        val code = d.pathSegments.lastOrNull() ?: d.host
        return code?.uppercase()?.takeIf { Regex("^[A-Z0-9]{5}$").matches(it) }
    }

    // Hands the room code to the game once the page is ready (the page asks for it on start too).
    private fun deliverRoom() {
        val code = pendingRoom ?: return
        web.evaluateJavascript("(window.ldDeepLink && window.ldDeepLink('$code')) ? 'y' : 'n'") { v ->
            if (v != null && v.contains("y")) pendingRoom = null
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        roomFrom(intent)?.let { pendingRoom = it; deliverRoom() }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        window.statusBarColor = Color.parseColor("#160D3D")
        window.navigationBarColor = Color.parseColor("#160D3D")

        pendingRoom = roomFrom(intent)
        setupWeb(savedInstanceState)
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                web.evaluateJavascript("(window.ldBack && window.ldBack()) ? 'y' : 'n'") { v ->
                    if (v == null || !v.contains("y")) finish()
                }
            }
        })
        (getSystemService(Context.AUDIO_SERVICE) as AudioManager).registerAudioDeviceCallback(deviceWatcher, null)
    }

    // Builds the game screen. Also used again if Android stops the game's renderer
    // (low memory or a graphics crash): instead of the app closing, it starts fresh and
    // the game offers to rejoin the online room.
    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWeb(savedInstanceState: Bundle?) {
        web = WebView(this)
        web.setBackgroundColor(Color.parseColor("#160D3D"))
        web.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, false)
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

            override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
                runOnUiThread {
                    try { (view.parent as? android.view.ViewGroup)?.removeView(view); view.destroy() } catch (e: Exception) { }
                    setupWeb(null)
                }
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

    override fun onDestroy() {
        try { (getSystemService(Context.AUDIO_SERVICE) as AudioManager).unregisterAudioDeviceCallback(deviceWatcher) } catch (e: Exception) { }
        super.onDestroy()
    }

    override fun onPause() { super.onPause(); web.onPause() }
    override fun onResume() { super.onResume(); web.onResume(); useLoudspeaker() }

    // Voice chat runs in "call" mode. Play it through headphones / Bluetooth when they are
    // connected, otherwise through the loudspeaker (call mode defaults to the small earpiece).
    private val headsetTypes = setOf(
        AudioDeviceInfo.TYPE_WIRED_HEADSET, AudioDeviceInfo.TYPE_WIRED_HEADPHONES,
        AudioDeviceInfo.TYPE_USB_HEADSET, AudioDeviceInfo.TYPE_BLUETOOTH_SCO
    ) + (if (Build.VERSION.SDK_INT >= 31) setOf(AudioDeviceInfo.TYPE_BLE_HEADSET) else emptySet())

    private fun useLoudspeaker() {
        try {
            val am = getSystemService(Context.AUDIO_SERVICE) as AudioManager
            am.mode = AudioManager.MODE_IN_COMMUNICATION
            if (Build.VERSION.SDK_INT >= 31) {
                val devices = am.availableCommunicationDevices
                val pick = devices.firstOrNull { it.type in headsetTypes }
                    ?: devices.firstOrNull { it.type == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER }
                if (pick != null) am.setCommunicationDevice(pick)
            } else {
                val outs = am.getDevices(AudioManager.GET_DEVICES_OUTPUTS)
                val wired = outs.any { it.type == AudioDeviceInfo.TYPE_WIRED_HEADSET || it.type == AudioDeviceInfo.TYPE_WIRED_HEADPHONES || it.type == AudioDeviceInfo.TYPE_USB_HEADSET }
                val bt = outs.any { it.type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO || it.type == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP }
                @Suppress("DEPRECATION")
                if (bt && !wired) { am.isSpeakerphoneOn = false; am.startBluetoothSco(); am.isBluetoothScoOn = true }
                else am.isSpeakerphoneOn = !wired
            }
        } catch (e: Exception) { /* keep default routing */ }
    }

    // Re-route when headphones are plugged in or taken out during a game.
    private val deviceWatcher = object : android.media.AudioDeviceCallback() {
        override fun onAudioDevicesAdded(added: Array<out AudioDeviceInfo>?) { useLoudspeaker() }
        override fun onAudioDevicesRemoved(removed: Array<out AudioDeviceInfo>?) { useLoudspeaker() }
    }

    private fun openOutside(url: Uri) {
        try { startActivity(Intent(Intent.ACTION_VIEW, url)) } catch (e: Exception) { /* no app for it */ }
    }

    inner class Bridge {
        @JavascriptInterface
        fun speaker() { runOnUiThread { useLoudspeaker() } } // picks headphones if connected, else loudspeaker

        @JavascriptInterface
        fun pickPhoto(from: String) {
            runOnUiThread {
                try {
                    if (from == "camera") takePhoto.launch(null) else galleryPick.launch("image/*")
                } catch (e: Exception) { photoDone(null) }
            }
        }

        @JavascriptInterface
        fun takeRoom(): String { val c = pendingRoom ?: ""; pendingRoom = null; return c }

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

        // Share a picture (the win card). to = "whatsapp" opens WhatsApp, anything else shows the share menu.
        @JavascriptInterface
        fun shareImage(dataUrl: String, text: String, to: String) {
            runOnUiThread {
                try {
                    val bytes = Base64.decode(dataUrl.substringAfter(","), Base64.DEFAULT)
                    val dir = java.io.File(cacheDir, "share").apply { mkdirs() }
                    val f = java.io.File(dir, "pitara-win.png")
                    f.writeBytes(bytes)
                    val uri = androidx.core.content.FileProvider.getUriForFile(this@MainActivity, "$packageName.share", f)
                    val send = Intent(Intent.ACTION_SEND).apply {
                        type = "image/png"
                        putExtra(Intent.EXTRA_STREAM, uri)
                        putExtra(Intent.EXTRA_TEXT, text)
                        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    }
                    val wa = Intent(send).apply { setPackage("com.whatsapp") }
                    if (to == "whatsapp") {
                        try { startActivity(wa) } catch (e: Exception) { startActivity(Intent.createChooser(send, "Share your win")) }
                    } else startActivity(Intent.createChooser(send, "Share your win"))
                } catch (e: Exception) { /* ignore */ }
            }
        }
    }
}
