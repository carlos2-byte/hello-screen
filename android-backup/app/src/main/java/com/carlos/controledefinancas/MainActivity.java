package com.carlos.controledefinancas;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.Gravity;
import android.widget.FrameLayout;

import androidx.core.splashscreen.SplashScreen;

import com.getcapacitor.BridgeActivity;
import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.AdSize;
import com.google.android.gms.ads.AdView;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.appopen.AppOpenAd;
import com.google.android.gms.ads.interstitial.InterstitialAd;
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback;
import com.google.android.gms.ads.LoadAdError;

public class MainActivity extends BridgeActivity {

    private static final String TAG = "AdMob";
    
    private static final String BANNER_ID = "ca-app-pub-2671131515539767/2926247201";
    private static final String APP_OPEN_ID = "ca-app-pub-2671131515539767/9244243541";
    private static final String INTERSTITIAL_ID = "ca-app-pub-2671131515539767/8950902951";
    
    private AdView adView;
    private AppOpenAd appOpenAd;
    private InterstitialAd mInterstitialAd;
    private Handler adHandler;
    
    private boolean isFirstLaunch = true;
    private boolean isAppOpenLoading = false;
    private boolean isInterstitialLoading = false;
    private boolean isInterstitialLoopStarted = false;
    private static final long AD_INTERVAL = 8 * 60 * 1000;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        SplashScreen.installSplashScreen(this);
        super.onCreate(savedInstanceState);

        Log.d(TAG, "onCreate iniciado");
        
        adHandler = new Handler(Looper.getMainLooper());
        
        MobileAds.initialize(this, initializationStatus -> {
            Log.d(TAG, "MobileAds inicializado");
        });

        createBanner();
        loadAppOpenAd();
        loadInterstitial();
    }

    private void createBanner() {
        Log.d(TAG, "Criando banner...");
        
        adView = new AdView(this);
        adView.setAdSize(AdSize.BANNER);
        adView.setAdUnitId(BANNER_ID);

        AdRequest adRequest = new AdRequest.Builder().build();
        adView.loadAd(adRequest);

        FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT,
                FrameLayout.LayoutParams.WRAP_CONTENT
        );
        params.gravity = Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL;

        FrameLayout rootLayout = findViewById(android.R.id.content);
        
        if (rootLayout != null) {
            rootLayout.addView(adView, params);
            Log.d(TAG, "Banner adicionado");
        }
    }

    private void loadAppOpenAd() {
        if (isAppOpenLoading || appOpenAd != null) {
            return;
        }
        
        isAppOpenLoading = true;
        Log.d(TAG, "Carregando App Open Ad...");

        AppOpenAd.load(this, APP_OPEN_ID, new AdRequest.Builder().build(),
                new AppOpenAd.AppOpenAdLoadCallback() {
                    @Override
                    public void onAdLoaded(AppOpenAd ad) {
                        appOpenAd = ad;
                        isAppOpenLoading = false;
                        Log.d(TAG, "App Open Ad carregado");
                        
                        if (isFirstLaunch) {
                            showAppOpenAd();
                        }
                    }

                    @Override
                    public void onAdFailedToLoad(LoadAdError loadAdError) {
                        Log.e(TAG, "Falha App Open: " + loadAdError.getMessage());
                        isAppOpenLoading = false;
                        startInterstitialLoopIfNeeded();
                    }
                });
    }

    private void showAppOpenAd() {
        if (appOpenAd != null) {
            Log.d(TAG, "Mostrando App Open Ad");
            
            appOpenAd.setFullScreenContentCallback(new FullScreenContentCallback() {
                @Override
                public void onAdDismissedFullScreenContent() {
                    Log.d(TAG, "App Open Ad fechado");
                    appOpenAd = null;
                    isFirstLaunch = false;
                    loadAppOpenAd();
                    startInterstitialLoopIfNeeded();
                }

                @Override
                public void onAdFailedToShowFullScreenContent(AdError adError) {
                    Log.e(TAG, "Falha ao mostrar App Open: " + adError.getMessage());
                    appOpenAd = null;
                    isFirstLaunch = false;
                    startInterstitialLoopIfNeeded();
                }

                @Override
                public void onAdShowedFullScreenContent() {
                    Log.d(TAG, "App Open Ad mostrado");
                }
            });
            
            appOpenAd.show(this);
        } else {
            Log.d(TAG, "App Open Ad não pronto");
            isFirstLaunch = false;
            startInterstitialLoopIfNeeded();
        }
    }

    private void startInterstitialLoopIfNeeded() {
        if (!isInterstitialLoopStarted) {
            Log.d(TAG, "Iniciando loop do Interstitial (8 minutos)");
            isInterstitialLoopStarted = true;
            
            adHandler.postDelayed(new Runnable() {
                @Override
                public void run() {
                    showInterstitial();
                    adHandler.postDelayed(this, AD_INTERVAL);
                }
            }, AD_INTERVAL);
        }
    }

    private void loadInterstitial() {
        if (isInterstitialLoading || mInterstitialAd != null) {
            return;
        }
        
        isInterstitialLoading = true;
        Log.d(TAG, "Carregando Interstitial...");

        InterstitialAd.load(this, INTERSTITIAL_ID, new AdRequest.Builder().build(),
                new InterstitialAdLoadCallback() {
                    @Override
                    public void onAdLoaded(InterstitialAd interstitialAd) {
                        mInterstitialAd = interstitialAd;
                        isInterstitialLoading = false;
                        Log.d(TAG, "Interstitial carregado");
                    }

                    @Override
                    public void onAdFailedToLoad(LoadAdError loadAdError) {
                        Log.e(TAG, "Falha Interstitial: " + loadAdError.getMessage());
                        isInterstitialLoading = false;
                        adHandler.postDelayed(() -> loadInterstitial(), 10000);
                    }
                });
    }

    private void showInterstitial() {
        if (mInterstitialAd != null) {
            Log.d(TAG, "Mostrando Interstitial");
            mInterstitialAd.show(this);
            mInterstitialAd = null;
            loadInterstitial();
        } else {
            Log.d(TAG, "Interstitial não pronto, carregando...");
            loadInterstitial();
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        
        if (!isFirstLaunch && appOpenAd != null) {
            showAppOpenAd();
            loadAppOpenAd();
        }
    }

    @Override
    public void onDestroy() {
        Log.d(TAG, "onDestroy");
        if (adView != null) {
            adView.destroy();
        }
        if (adHandler != null) {
            adHandler.removeCallbacksAndMessages(null);
        }
        super.onDestroy();
    }
}