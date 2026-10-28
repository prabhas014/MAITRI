import React, { useRef, useEffect, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import * as faceapi from '@vladmandic/face-api';

export default function WebcamEmotion({ onEmotionDetected }) {
  const webcamRef = useRef(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [currentEmotion, setCurrentEmotion] = useState('Neutral');

  useEffect(() => {
    const loadModels = async () => {
      try {
        const MODEL_URL = '/models';
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)
        ]);
        setModelsLoaded(true);
      } catch (err) {
        console.error("Failed to load face-api models:", err);
      }
    };
    loadModels();
  }, []);

  const detectEmotion = useCallback(async () => {
    if (
      typeof webcamRef.current !== "undefined" &&
      webcamRef.current !== null &&
      webcamRef.current.video.readyState === 4 &&
      webcamRef.current.video.videoWidth > 0 &&
      webcamRef.current.video.videoHeight > 0 &&
      modelsLoaded
    ) {
      const video = webcamRef.current.video;
      
      try {
        const detection = await faceapi
          .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
          .withFaceExpressions();

        if (detection) {
          const expressions = detection.expressions;
          // Find the emotion with the highest probability
          let maxProb = 0;
          let maxEmotion = 'neutral';
          for (const [emotion, probability] of Object.entries(expressions)) {
            if (probability > maxProb) {
              maxProb = probability;
              maxEmotion = emotion;
            }
          }
          
          // Capitalize first letter
          const formattedEmotion = maxEmotion.charAt(0).toUpperCase() + maxEmotion.slice(1);
          
          if (formattedEmotion !== currentEmotion) {
            setCurrentEmotion(formattedEmotion);
            if (onEmotionDetected) {
              onEmotionDetected(formattedEmotion);
            }
          }
        }
      } catch (error) {
        console.error("Detection error:", error);
      }
    }
  }, [modelsLoaded, currentEmotion, onEmotionDetected]);

  useEffect(() => {
    let intervalId;
    if (isDetecting) {
      intervalId = setInterval(detectEmotion, 1000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isDetecting, detectEmotion]);

  const handleVideoLoad = () => {
    setIsDetecting(true);
  };

  return (
    <div className="relative rounded-lg overflow-hidden border border-white/10 bg-black/40">
      {!modelsLoaded && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/80 text-white text-sm">
          Loading Datasets...
        </div>
      )}
      <Webcam
        ref={webcamRef}
        muted={true}
        onUserMedia={handleVideoLoad}
        className="w-full h-auto object-cover"
        style={{ transform: 'scaleX(-1)' }} // Mirror the video
        videoConstraints={{
          width: 640,
          height: 480,
          facingMode: "user"
        }}
      />
      <div className="absolute bottom-4 left-4 bg-black/60 px-3 py-1 rounded-full text-xs font-mono text-blue-300">
        Emotion: {currentEmotion}
      </div>
    </div>
  );
}
