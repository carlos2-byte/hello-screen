import { useEffect, useCallback, useRef, useState } from 'react';
import fundoImg from '@/assets/Fundo.png';

interface SplashScreenProps {
  onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const stableOnComplete = useCallback(onComplete, []);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoReady, setVideoReady] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(stableOnComplete, 4300);
    return () => clearTimeout(timeout);
  }, [stableOnComplete]);

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.play().catch(() => {});
    }
  }, []);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black">
      {/* Pre-splash background image shown until video is ready */}
      {!videoReady && (
        <img
          src={fundoImg}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        loop
        preload="auto"
        controls={false}
        disablePictureInPicture
        controlsList="nodownload nofullscreen noremoteplayback"
        className="w-full h-full object-cover block"
        style={{ objectFit: 'cover', background: 'black', opacity: videoReady ? 1 : 0 }}
        onCanPlay={() => setVideoReady(true)}
      >
        <source src="/splash-video.mp4" type="video/mp4" />
      </video>
    </div>
  );
}
