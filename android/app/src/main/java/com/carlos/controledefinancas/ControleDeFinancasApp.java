package com.carlos.controledefinancas;

import android.app.Application;
import android.util.Log;

import com.google.android.gms.ads.MobileAds;

/**
 * Application class — inicializa Mobile Ads SDK.
 * Banner e Interstitial são controlados via JS (@capacitor-community/admob).
 */
public class ControleDeFinancasApp extends Application {

    private static final String TAG = "ControleDeFinancasApp";

    @Override
    public void onCreate() {
        super.onCreate();

        // Inicializa Mobile Ads SDK (necessário para o plugin Capacitor funcionar)
        MobileAds.initialize(this, initializationStatus -> {
            Log.d(TAG, "MobileAds SDK initialized.");
        });
    }
}
