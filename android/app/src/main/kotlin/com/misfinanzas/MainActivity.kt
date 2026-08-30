package com.misfinanzas

import android.os.Build
import android.os.Bundle
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webview)

        // Configure WebView
        with(webView.settings) {
            javaScriptEnabled = true
            databaseEnabled = true
            domStorageEnabled = true

            // Set cache mode
            cacheMode = WebSettings.LOAD_DEFAULT

            // Set user agent for better compatibility
            userAgentString = userAgentString + " MisFinanzasAndroid/1.0"
        }

        // Set WebViewClient to handle navigation
        webView.webViewClient = WebViewClient()

        // Load HTML from assets
        webView.loadUrl("file:///android_asset/misfinanzas.html")
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }
}
